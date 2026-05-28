use std::{
    net::{IpAddr, Ipv4Addr, Ipv6Addr},
    path::{Path, PathBuf},
    process::Command,
    time::Duration,
};

use tauri::{AppHandle, Emitter, LogicalSize, Manager, State};
use tracing::{error, info, warn};

use crate::{
    models::{
        debug::{DebugRuntimeSnapshot, UiDebugReport},
        locale::LocaleInfo,
        path_validation::PathValidation,
        profile::ProfileSummary,
        settings::{
            default_connectivity_endpoints, default_ip_endpoints, AppSettings, LatencyMode,
            UiSettingsPatch, V2RayNPathMode,
        },
        status::{ConnectionState, DashboardStatus},
    },
    services::{
        config_reader,
        health_check::{self, HealthCheckOptions},
        log_reader,
        privilege,
        process_monitor,
        status_service::{self, StatusInputs},
        ui_controller,
    },
    state::app_state::AppState,
    utils::{app_paths, autostart, settings_store},
};

const UIPI_MISMATCH_PREFIX: &str = "UIPI_MISMATCH";
const PROFILE_IP_SETTLE_DELAY: Duration = Duration::from_secs(5);

#[tauri::command]
pub async fn get_status(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    Ok(state.snapshot().status)
}

#[tauri::command]
pub async fn refresh_status(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    let snapshot = state.snapshot();

    if snapshot.settings.mock_mode_enabled {
        let mock = build_mock_status(&snapshot.status, &snapshot.settings, None, None);
        state.update_status(mock.clone());
        return Ok(mock);
    }

    let status = refresh_status_from_settings(&snapshot.settings, true, true, false)
        .await
        .map_err(|error| {
            error!(?error, "refresh_status failed");
            error.to_string()
        })?;

    let merged = merge_with_previous(status, &snapshot.status);
    state.update_status(merged.clone());
    Ok(merged)
}

#[tauri::command]
pub async fn refresh_status_post_route(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    let snapshot = state.snapshot();

    if snapshot.settings.mock_mode_enabled {
        let mock = build_mock_status(&snapshot.status, &snapshot.settings, None, None);
        state.update_status(mock.clone());
        return Ok(mock);
    }

    let status = refresh_status_from_settings(&snapshot.settings, false, true, false)
        .await
        .map_err(|error| {
            error!(?error, "refresh_status_post_route failed");
            error.to_string()
        })?;

    let merged = merge_with_previous(status, &snapshot.status);
    state.update_status(merged.clone());
    Ok(merged)
}
#[tauri::command]
pub async fn refresh_status_background(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    let snapshot = state.snapshot();

    if snapshot.settings.mock_mode_enabled {
        let mock = build_mock_status(&snapshot.status, &snapshot.settings, None, None);
        state.update_status(mock.clone());
        return Ok(mock);
    }

    let status = refresh_status_from_settings(&snapshot.settings, true, false, false)
        .await
        .map_err(|error| {
            error!(?error, "refresh_status_background failed");
            error.to_string()
        })?;

    let mut merged = merge_with_previous(status, &snapshot.status);

    if profile_changed(
        snapshot.status.active_profile_name.as_deref(),
        merged.active_profile_name.as_deref(),
    ) {
        tokio::time::sleep(PROFILE_IP_SETTLE_DELAY).await;

        let with_external_ip = refresh_status_from_settings(&snapshot.settings, true, true, false)
            .await
            .map_err(|error| {
                error!(?error, "refresh_status_background profile-change external-ip refresh failed");
                error.to_string()
            })?;

        merged = merge_with_previous(with_external_ip, &merged);
    }

    state.update_status(merged.clone());
    Ok(merged)
}

#[tauri::command]
pub async fn refresh_status_startup(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    let snapshot = state.snapshot();

    if snapshot.settings.mock_mode_enabled {
        let mock = build_mock_status(&snapshot.status, &snapshot.settings, None, None);
        state.update_status(mock.clone());
        return Ok(mock);
    }

    let status = refresh_status_from_settings(&snapshot.settings, true, true, true)
        .await
        .map_err(|error| {
            error!(?error, "refresh_status_startup failed");
            error.to_string()
        })?;

    let merged = merge_with_previous(status, &snapshot.status);
    state.update_status(merged.clone());
    Ok(merged)
}

#[tauri::command]
pub async fn toggle_tun_via_ui(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    let snapshot = state.snapshot();

    if snapshot.settings.mock_mode_enabled {
        let mock = build_mock_status(
            &snapshot.status,
            &snapshot.settings,
            Some(!snapshot.status.tun_enabled),
            None,
        );
        state.update_status(mock.clone());
        return Ok(mock);
    }

    ensure_uipi_compatible_for_control()?;

    let allow_restart_fallback = snapshot.settings.allow_restart_fallback;
    let base_path =
        resolve_v2rayn_base_path(&snapshot.settings).ok_or_else(|| "v2rayN path not found".to_owned())?;

    let before = config_reader::read_config(&base_path)
        .ok()
        .and_then(|cfg| cfg.enable_tun);

    let automation_result = ui_controller::toggle_tun_via_ui();

    tokio::time::sleep(Duration::from_millis(950)).await;

    let after_ui = config_reader::read_config(&base_path)
        .ok()
        .and_then(|cfg| cfg.enable_tun);

    let need_fallback = automation_result.is_err() || (before.is_some() && after_ui == before);

    if need_fallback {
        if !allow_restart_fallback {
            return Err("UI toggle did not apply and restart fallback is disabled in Settings".to_owned());
        }

        if let Err(error) = &automation_result {
            warn!(?error, "UI toggle failed, using config fallback");
        } else {
            warn!(?before, ?after_ui, "UI toggle did not change config state, using fallback");
        }

        let expected_enable_tun = config_reader::toggle_tun_mode(&base_path)
            .map_err(|error| format!("toggle failed (fallback): {error}"))?;

        if process_monitor::read_process_snapshot().v2rayn_running {
            let mut reloaded_without_restart = false;

            match ui_controller::click_reload_via_ui() {
                Ok(note) => {
                    info!(%note, "fallback applied through UI Reload");
                    tokio::time::sleep(Duration::from_millis(1200)).await;

                    let after_reload = config_reader::read_config(&base_path)
                        .ok()
                        .and_then(|cfg| cfg.enable_tun);

                    if after_reload == Some(expected_enable_tun) {
                        reloaded_without_restart = true;
                    } else {
                        warn!(
                            ?after_reload,
                            expected_enable_tun,
                            "UI Reload executed but expected state was not observed"
                        );
                    }
                }
                Err(error) => {
                    warn!(?error, "UI Reload is unavailable, using process restart fallback");
                }
            }

            if !reloaded_without_restart {
                restart_v2rayn_process(&base_path)
                    .map_err(|error| format!("toggle fallback changed config but restart failed: {error}"))?;
                tokio::time::sleep(Duration::from_millis(1200)).await;
            }
        }
    }

    let status = refresh_status_after_route_change(&snapshot.settings, &snapshot.status)
        .await
        .map_err(|error| {
            error!(?error, "status refresh after toggle failed");
            error.to_string()
        })?;

    let merged = merge_with_previous(status, &snapshot.status);
    state.update_status(merged.clone());
    Ok(merged)
}

#[tauri::command]
pub async fn set_active_profile(
    profile_id: String,
    state: State<'_, AppState>,
) -> Result<DashboardStatus, String> {
    let snapshot = state.snapshot();
    let requested_profile_id = profile_id.trim().to_owned();

    if requested_profile_id.is_empty() {
        return Err("profile id is empty".to_owned());
    }

    if snapshot.settings.mock_mode_enabled {
        let profiles = mock_profiles();
        let target_profile = profiles
            .iter()
            .find(|item| item.id == requested_profile_id)
            .ok_or_else(|| format!("Profile not found: {requested_profile_id}"))?;

        let mock = build_mock_status(
            &snapshot.status,
            &snapshot.settings,
            None,
            Some(target_profile.name.clone()),
        );
        state.update_status(mock.clone());
        return Ok(mock);
    }

    ensure_uipi_compatible_for_control()?;

    let allow_restart_fallback = snapshot.settings.allow_restart_fallback;
    let base_path = resolve_v2rayn_base_path(&snapshot.settings)
        .ok_or_else(|| "v2rayN path not found".to_owned())?;

    let config_before = config_reader::read_config(&base_path).map_err(|error| {
        error!(?error, "set_active_profile: initial config read failed");
        error.to_string()
    })?;

    let target_profile = config_before
        .profiles
        .iter()
        .find(|item| item.id == requested_profile_id)
        .cloned()
        .ok_or_else(|| format!("Profile not found: {requested_profile_id}"))?;

    if profile_name_matches(config_before.active_profile_name.as_deref(), &target_profile.name) {
        let status = refresh_status_from_settings(&snapshot.settings, true, true, true)
            .await
            .map_err(|error| {
                error!(?error, "status refresh after set_active_profile no-op failed");
                error.to_string()
            })?;

        let merged = merge_with_previous(status, &snapshot.status);
        state.update_status(merged.clone());
        return Ok(merged);
    }

    let process_snapshot = process_monitor::read_process_snapshot();
    let mut applied_via_ui = false;

    if process_snapshot.v2rayn_running {
        match ui_controller::set_active_profile_via_ui(&target_profile.name) {
            Ok(note) => {
                info!(%note, target_profile = %target_profile.name, "UI profile switch attempt executed");
                tokio::time::sleep(Duration::from_millis(900)).await;

                let after_ui = config_reader::read_config(&base_path)
                    .ok()
                    .and_then(|cfg| cfg.active_profile_name);

                applied_via_ui = profile_name_matches(after_ui.as_deref(), &target_profile.name);

                if !applied_via_ui {
                    warn!(
                        expected_profile = %target_profile.name,
                        observed_profile = ?after_ui,
                        "UI profile switch did not update active profile"
                    );
                }
            }
            Err(error) => {
                warn!(?error, target_profile = %target_profile.name, "UI profile switch failed, fallback required");
            }
        }
    }

    if !applied_via_ui {
        if !allow_restart_fallback {
            return Err("UI profile switch did not apply and restart fallback is disabled in Settings".to_owned());
        }

        config_reader::set_active_profile(&base_path, &requested_profile_id).map_err(|error| {
            error!(?error, "set_active_profile fallback config write failed");
            error.to_string()
        })?;

        if process_snapshot.v2rayn_running {
            let mut reloaded_without_restart = false;

            match ui_controller::click_reload_via_ui() {
                Ok(note) => {
                    info!(%note, "profile fallback applied through UI Reload");
                    tokio::time::sleep(Duration::from_millis(1200)).await;

                    let after_reload = config_reader::read_config(&base_path)
                        .ok()
                        .and_then(|cfg| cfg.active_profile_name);

                    if profile_name_matches(after_reload.as_deref(), &target_profile.name) {
                        reloaded_without_restart = true;
                    } else {
                        warn!(
                            expected_profile = %target_profile.name,
                            observed_profile = ?after_reload,
                            "UI Reload executed but profile state was not updated"
                        );
                    }
                }
                Err(error) => {
                    warn!(?error, "UI Reload unavailable for profile fallback");
                }
            }

            if !reloaded_without_restart {
                restart_v2rayn_process(&base_path).map_err(|error| {
                    error!(?error, "restart after profile change fallback failed");
                    error.to_string()
                })?;
                tokio::time::sleep(Duration::from_millis(1500)).await;
            }
        }
    }

    let status = refresh_status_after_route_change(&snapshot.settings, &snapshot.status)
        .await
        .map_err(|error| {
            error!(?error, "status refresh after set_active_profile failed");
            error.to_string()
        })?;

    let merged = merge_with_previous(status, &snapshot.status);
    state.update_status(merged.clone());
    Ok(merged)
}

#[tauri::command]
pub async fn open_v2rayn(state: State<'_, AppState>) -> Result<(), String> {
    let settings = state.snapshot().settings;
    let base_path =
        resolve_v2rayn_base_path(&settings).ok_or_else(|| "v2rayN path not found".to_owned())?;

    open_v2rayn_process(&base_path)
}

#[tauri::command]
pub async fn restart_v2rayn(state: State<'_, AppState>) -> Result<(), String> {
    ensure_uipi_compatible_for_control()?;

    let settings = state.snapshot().settings;
    let base_path =
        resolve_v2rayn_base_path(&settings).ok_or_else(|| "v2rayN path not found".to_owned())?;

    restart_v2rayn_process(&base_path).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    Ok(state.snapshot().settings)
}

#[tauri::command]
pub async fn update_settings(
    payload: AppSettings,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppSettings, String> {
    let settings = normalize_settings(payload);

    settings_store::save_settings(&settings).map_err(|error| error.to_string())?;
    state.update_settings(settings.clone());

    if settings.mock_mode_enabled {
        let snapshot = state.snapshot();
        let mock = build_mock_status(&snapshot.status, &settings, None, None);
        state.update_status(mock);
    }

    apply_runtime_settings(&app, &settings);
    emit_settings_updated(&app, &settings);

    Ok(settings)
}

#[tauri::command]
pub async fn apply_ui_settings(
    payload: UiSettingsPatch,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppSettings, String> {
    let snapshot = state.snapshot();
    let mut merged = snapshot.settings;

    if let Some(value) = payload.language {
        merged.language = value;
    }
    if let Some(value) = payload.theme {
        merged.theme = value;
    }
    if let Some(value) = payload.always_on_top {
        merged.always_on_top = value;
    }
    if let Some(value) = payload.time_format {
        merged.time_format = value;
    }
    if let Some(value) = payload.show_clock {
        merged.show_clock = value;
    }
    if let Some(value) = payload.show_info_status {
        merged.show_info_status = value;
    }
    if let Some(value) = payload.show_external_ip {
        merged.show_external_ip = value;
    }
    if let Some(value) = payload.show_latency {
        merged.show_latency = value;
    }
    if let Some(value) = payload.mock_mode_enabled {
        merged.mock_mode_enabled = value;
    }
    if let Some(value) = payload.show_action_buttons {
        merged.show_action_buttons = value;
    }
    if let Some(value) = payload.show_profile_selector {
        merged.show_profile_selector = value;
    }
    if let Some(value) = payload.window_effect_enabled {
        merged.window_effect_enabled = value;
    }
    if let Some(value) = payload.window_opacity_percent {
        merged.window_opacity_percent = value;
    }
    let settings = normalize_settings(merged);

    settings_store::save_settings(&settings).map_err(|error| error.to_string())?;
    state.update_settings(settings.clone());

    if settings.mock_mode_enabled {
        let snapshot = state.snapshot();
        let mock = build_mock_status(&snapshot.status, &settings, None, None);
        state.update_status(mock);
    }

    apply_runtime_settings(&app, &settings);
    emit_settings_updated(&app, &settings);

    Ok(settings)
}

#[tauri::command]
pub async fn open_settings_window(app: AppHandle) -> Result<(), String> {
    show_window(&app, "settings")
}

#[tauri::command]
pub async fn open_debug_window(app: AppHandle) -> Result<(), String> {
    show_window(&app, "debug")
}

#[tauri::command]
pub async fn run_ui_debug_probe() -> Result<UiDebugReport, String> {
    let mut report = ui_controller::debug_probe().map_err(|error| error.to_string())?;

    if report.window_process_name.is_none() {
        if let Some(pid) = report.window_pid {
            report.window_process_name = process_monitor::process_name_by_pid(pid);
        }
    }

    if let Ok(diag) = privilege::collect_v2rayn_privilege_diagnostics() {
        report.privilege = diag;
    }

    Ok(report)
}

#[tauri::command]
pub async fn debug_toggle_via_ui_only() -> Result<String, String> {
    ensure_uipi_compatible_for_control()?;
    ui_controller::debug_toggle_via_ui_only().map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn debug_click_reload_via_ui() -> Result<String, String> {
    ensure_uipi_compatible_for_control()?;
    ui_controller::debug_click_reload_via_ui_only().map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn debug_select_profile_via_ui(profile_name: String) -> Result<String, String> {
    ensure_uipi_compatible_for_control()?;
    ui_controller::debug_select_profile_via_ui_only(profile_name.trim())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn debug_capture_runtime_snapshot(
    state: State<'_, AppState>,
) -> Result<DebugRuntimeSnapshot, String> {
    let settings = state.snapshot().settings;
    collect_runtime_snapshot(&settings).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn debug_toggle_via_config_only(state: State<'_, AppState>) -> Result<String, String> {
    ensure_uipi_compatible_for_control()?;

    let settings = state.snapshot().settings;
    let base_path =
        resolve_v2rayn_base_path(&settings).ok_or_else(|| "v2rayN path not found".to_owned())?;

    let value = config_reader::toggle_tun_mode(&base_path).map_err(|error| error.to_string())?;

    if process_monitor::read_process_snapshot().v2rayn_running {
        match ui_controller::click_reload_via_ui() {
            Ok(note) => return Ok(format!("Config EnableTun set to {value}. {note}")),
            Err(error) => {
                restart_v2rayn_process(&base_path).map_err(|restart_error| {
                    format!(
                        "Config changed but reload ({error}) and restart ({restart_error}) both failed"
                    )
                })?;
            }
        }
    }

    Ok(format!("Config EnableTun set to {value}"))
}
#[tauri::command]
pub async fn relaunch_widget_as_admin(app: AppHandle) -> Result<(), String> {
    privilege::relaunch_self_as_admin().map_err(|error| error.to_string())?;
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub async fn detect_v2rayn_path() -> Result<Option<String>, String> {
    Ok(detect_v2rayn_path_best_effort().map(|path| path.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn validate_v2rayn_path(path: String) -> Result<PathValidation, String> {
    let normalized = path.trim().to_owned();
    let candidate = PathBuf::from(&normalized);
    let valid = app_paths::is_valid_v2rayn_path(&candidate);

    let message_key = if valid {
        "settings.pathValid".to_owned()
    } else {
        "settings.pathInvalid".to_owned()
    };

    Ok(PathValidation {
        is_valid: valid,
        message_key,
        normalized_path: normalized,
    })
}

#[tauri::command]
pub async fn get_available_locales() -> Result<Vec<LocaleInfo>, String> {
    Ok(vec![
        LocaleInfo {
            code: "en".to_owned(),
            label: "English".to_owned(),
            native_label: "English".to_owned(),
        },
        LocaleInfo {
            code: "ru".to_owned(),
            label: "Russian".to_owned(),
            native_label: "Русский".to_owned(),
        },
    ])
}

#[tauri::command]
pub async fn list_profiles(state: State<'_, AppState>) -> Result<Vec<ProfileSummary>, String> {
    let settings = state.snapshot().settings;

    if settings.mock_mode_enabled {
        return Ok(mock_profiles());
    }

    let Some(path) = resolve_v2rayn_base_path(&settings) else {
        warn!("list_profiles skipped because v2rayN path is not configured");
        return Ok(Vec::new());
    };

    match config_reader::read_config(&path) {
        Ok(snapshot) => Ok(snapshot.profiles),
        Err(error) => {
            warn!(?error, "Failed to list profiles");
            Ok(Vec::new())
        }
    }
}

#[tauri::command]
pub async fn close_window(label: String, app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("Window not found: {label}"))?;

    window.hide().map_err(|error| error.to_string())?;

    if label != "main" {
        if let Some(main) = app.get_webview_window("main") {
            let _ = main.show();
            let _ = main.unminimize();
            let _ = main.set_focus();
        }
    }

    info!(%label, "window hidden by command");
    Ok(())
}

#[tauri::command]
pub async fn set_main_window_height(height: u32, app: AppHandle) -> Result<(), String> {
    let clamped = height.clamp(270, 760);
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Window not found: main".to_owned())?;

    window
        .set_size(LogicalSize::new(360.0, clamped as f64))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn exit_app(app: AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

pub async fn refresh_status_from_settings(
    settings: &AppSettings,
    include_latency_probe: bool,
    include_external_ip_probe: bool,
    force_full_probe: bool,
) -> anyhow::Result<DashboardStatus> {
    let base_path = resolve_v2rayn_base_path(settings)
        .ok_or_else(|| anyhow::anyhow!("Could not resolve v2rayN installation path"))?;

    let config = config_reader::read_config(&base_path)?;
    let logs = match log_reader::read_latest_log(&base_path) {
        Ok(logs) => Some(logs),
        Err(error) => {
            warn!(?error, "Could not read latest log");
            None
        }
    };

    let process = process_monitor::read_process_snapshot();

    let effective_latency_mode = if force_full_probe {
        LatencyMode::Active
    } else {
        settings.latency_mode.clone()
    };

    let check_latency = include_latency_probe && (settings.show_latency || force_full_probe);
    let check_external_ip = include_external_ip_probe && (settings.show_external_ip || force_full_probe);

    let health_options = HealthCheckOptions {
        enable_external_ip: check_external_ip,
        enable_connectivity_latency: check_latency,
        latency_mode: effective_latency_mode.clone(),
        connectivity_endpoints: settings.connectivity_endpoints.clone(),
        ip_endpoints: settings.ip_endpoints.clone(),
    };

    let health = if health_options.enable_external_ip
        || (health_options.enable_connectivity_latency
            && matches!(health_options.latency_mode, LatencyMode::Active))
    {
        let client = health_check::build_http_client()?;
        health_check::check(&client, &health_options).await
    } else {
        health_check::HealthSnapshot::default()
    };

    Ok(status_service::resolve_status(StatusInputs {
        config,
        logs,
        process,
        health,
        require_connectivity_check: check_latency
            && matches!(effective_latency_mode, LatencyMode::Active),
        require_external_ip_check: check_external_ip,
    }))
}

fn merge_with_previous(mut next: DashboardStatus, previous: &DashboardStatus) -> DashboardStatus {
    if next.external_ip.is_none() {
        next.external_ip = previous.external_ip.clone();
    }

    if next.latency_ms.is_none() {
        next.latency_ms = previous.latency_ms;
    }

    if next.active_profile_name.is_none() {
        next.active_profile_name = previous.active_profile_name.clone();
    }

    next
}

async fn refresh_status_after_route_change(
    settings: &AppSettings,
    previous: &DashboardStatus,
) -> anyhow::Result<DashboardStatus> {
    // Route-change actions (toggle/profile switch) should return fast.
    // We avoid blocking on network probes here; delayed full refresh is triggered from frontend.
    let status = refresh_status_from_settings(settings, false, false, false).await?;
    Ok(merge_with_previous(status, previous))
}
fn collect_runtime_snapshot(settings: &AppSettings) -> anyhow::Result<DebugRuntimeSnapshot> {
    let process = process_monitor::read_process_snapshot();
    let mut snapshot = DebugRuntimeSnapshot {
        v2rayn_running: process.v2rayn_running,
        v2rayn_pid: process.v2rayn_pid,
        ..DebugRuntimeSnapshot::default()
    };

    if let Some(base_path) = resolve_v2rayn_base_path(settings) {
        if let Ok(config) = config_reader::read_config(&base_path) {
            snapshot.enable_tun = config.enable_tun;
            snapshot.active_profile_name = config.active_profile_name;
        }

        if let Ok(logs) = log_reader::read_latest_log(&base_path) {
            snapshot.last_event = logs.last_event;
            snapshot.last_error = logs.last_error;
        }
    }

    Ok(snapshot)
}
fn detect_v2rayn_path_best_effort() -> Option<PathBuf> {
    app_paths::detect_v2rayn_path().or_else(process_monitor::v2rayn_base_path_from_running_process)
}

fn resolve_v2rayn_base_path(settings: &AppSettings) -> Option<PathBuf> {
    match settings.v2rayn_path_mode {
        V2RayNPathMode::Manual => normalize_manual_path(settings.v2rayn_path.clone())
            .map(PathBuf::from)
            .filter(|path| app_paths::is_valid_v2rayn_path(path)),
        V2RayNPathMode::Auto => detect_v2rayn_path_best_effort(),
    }
    .or_else(|| {
        normalize_manual_path(settings.v2rayn_path.clone())
            .as_deref()
            .map(Path::new)
            .filter(|path| app_paths::is_valid_v2rayn_path(path))
            .map(Path::to_path_buf)
    })
}

fn normalize_settings(mut settings: AppSettings) -> AppSettings {
    settings.poll_interval_sec = settings.poll_interval_sec.clamp(1, 3600);
    settings.window_opacity_percent = settings.window_opacity_percent.clamp(10, 100);
    settings.v2rayn_path = normalize_manual_path(settings.v2rayn_path);

    settings.connectivity_endpoints = normalize_endpoint_list(
        settings.connectivity_endpoints,
        default_connectivity_endpoints(),
    );

    settings.ip_endpoints = normalize_endpoint_list(settings.ip_endpoints, default_ip_endpoints());

    settings
}

fn normalize_manual_path(value: Option<String>) -> Option<String> {
    value
        .map(|path| path.trim().to_owned())
        .filter(|path| !path.is_empty())
}

fn normalize_endpoint_list(values: Vec<String>, fallback: Vec<String>) -> Vec<String> {
    let filtered = values
        .into_iter()
        .map(|value| value.trim().to_owned())
        .filter(|value| is_allowed_http_endpoint(value))
        .collect::<Vec<_>>();

    if filtered.is_empty() {
        fallback
    } else {
        filtered
    }
}

fn is_allowed_http_endpoint(value: &str) -> bool {
    let Ok(url) = reqwest::Url::parse(value) else {
        return false;
    };

    if !matches!(url.scheme(), "http" | "https") {
        return false;
    }

    let Some(host) = url.host_str() else {
        return false;
    };

    is_allowed_endpoint_host(host)
}

fn is_allowed_endpoint_host(host: &str) -> bool {
    let host = host.trim().trim_matches(['[', ']']).to_lowercase();
    if host.is_empty() || host == "localhost" || host.ends_with(".localhost") {
        return false;
    }

    match host.parse::<IpAddr>() {
        Ok(IpAddr::V4(addr)) => is_allowed_ipv4_endpoint(addr),
        Ok(IpAddr::V6(addr)) => is_allowed_ipv6_endpoint(addr),
        Err(_) => true,
    }
}

fn is_allowed_ipv4_endpoint(addr: Ipv4Addr) -> bool {
    !(addr.is_private()
        || addr.is_loopback()
        || addr.is_link_local()
        || addr.is_broadcast()
        || addr.is_documentation()
        || addr.is_unspecified())
}

fn is_allowed_ipv6_endpoint(addr: Ipv6Addr) -> bool {
    !(addr.is_loopback()
        || addr.is_unspecified()
        || addr.is_unique_local()
        || addr.is_unicast_link_local()
        || is_documentation_ipv6(addr))
}

fn is_documentation_ipv6(addr: Ipv6Addr) -> bool {
    let segments = addr.segments();
    segments[0] == 0x2001 && segments[1] == 0x0db8
}

fn profile_name_matches(current: Option<&str>, expected: &str) -> bool {
    let current = current
        .map(|value| value.trim().to_lowercase())
        .unwrap_or_default();
    let expected = expected.trim().to_lowercase();

    if current.is_empty() || expected.is_empty() {
        return false;
    }

    current == expected || current.contains(&expected) || expected.contains(&current)
}

fn profile_changed(previous: Option<&str>, current: Option<&str>) -> bool {
    let normalize = |value: Option<&str>| -> Option<String> {
        value
            .map(|item| item.trim().to_lowercase())
            .filter(|item| !item.is_empty())
    };

    normalize(previous) != normalize(current)
}

fn mock_profiles() -> Vec<ProfileSummary> {
    vec![
        ProfileSummary {
            id: "mock-eu".to_owned(),
            name: "eu-demo-fast".to_owned(),
        },
        ProfileSummary {
            id: "mock-us".to_owned(),
            name: "us-demo-stream".to_owned(),
        },
        ProfileSummary {
            id: "mock-apac".to_owned(),
            name: "apac-demo-gaming".to_owned(),
        },
    ]
}

fn build_mock_status(
    previous: &DashboardStatus,
    settings: &AppSettings,
    tun_override: Option<bool>,
    profile_override: Option<String>,
) -> DashboardStatus {
    let mock_profiles = mock_profiles();

    let active_profile_name = profile_override.or_else(|| {
        previous
            .active_profile_name
            .as_ref()
            .filter(|name| mock_profiles.iter().any(|item| item.name == **name))
            .cloned()
    })
    .or_else(|| mock_profiles.first().map(|item| item.name.clone()));

    let tun_enabled = tun_override.unwrap_or(previous.tun_enabled);
    let connection_state = if tun_enabled {
        ConnectionState::Connected
    } else {
        ConnectionState::Disconnected
    };

    DashboardStatus {
        status: connection_state,
        tun_enabled,
        connection_state,
        active_profile_name,
        external_ip: Some([203, 0, 113, 45].map(|part| part.to_string()).join(".")),
        latency_ms: Some(42),
        last_error: None,
        last_event: Some(if settings.language.starts_with("ru") {
            "Mockup режим активен".to_owned()
        } else {
            "Mockup mode is enabled".to_owned()
        }),
        ..DashboardStatus::default()
    }
}

fn ensure_uipi_compatible_for_control() -> Result<(), String> {
    let diagnostics = privilege::collect_v2rayn_privilege_diagnostics().map_err(|error| {
        warn!(?error, "privilege diagnostics failed");
        error.to_string()
    })?;

    if diagnostics.uipi_mismatch {
        let pid = diagnostics
            .v2rayn_pid
            .map(|value| value.to_string())
            .unwrap_or_else(|| "unknown".to_owned());

        return Err(format!(
            "{UIPI_MISMATCH_PREFIX}: v2rayN is running as Administrator (PID {pid}), but widget is running without Administrator rights. Run both apps with same rights, or use 'Restart widget as Administrator'."
        ));
    }

    Ok(())
}

fn open_v2rayn_process(base_path: &Path) -> Result<(), String> {
    let exe_path = base_path.join("v2rayN.exe");

    Command::new(exe_path)
        .spawn()
        .map_err(|error| error.to_string())?;

    info!("open_v2rayn requested");
    Ok(())
}

fn restart_v2rayn_process(base_path: &Path) -> anyhow::Result<()> {
    if !process_monitor::terminate_v2rayn_at_path(base_path) {
        warn!(
            base_path = %base_path.display(),
            "no running v2rayN process matched configured path during restart"
        );
    }
    std::thread::sleep(Duration::from_millis(750));

    open_v2rayn_process(base_path).map_err(anyhow::Error::msg)
}

fn apply_runtime_settings(app: &AppHandle, settings: &AppSettings) {
    for label in ["main", "settings", "debug"] {
        if let Some(window) = app.get_webview_window(label) {
            let _ = window.set_always_on_top(settings.always_on_top);
        }
    }

    if let Err(error) = autostart::apply_autostart(settings.autostart_with_windows) {
        warn!(?error, "failed to apply autostart setting");
    }
}

fn emit_settings_updated(app: &AppHandle, settings: &AppSettings) {
    if let Err(error) = app.emit("settings-updated", settings) {
        warn!(?error, "failed to emit settings-updated event");
    }
}

fn show_window(app: &AppHandle, label: &str) -> Result<(), String> {
    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("Window not found: {label}"))?;

    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn normalize_endpoint_list_filters_invalid_and_non_http_urls() {
        let result = normalize_endpoint_list(
            vec![
                " https://example.com/ip ".to_owned(),
                "ftp://example.com/not-http".to_owned(),
                "not a url".to_owned(),
                "http://example.net/check".to_owned(),
            ],
            vec!["https://fallback.example".to_owned()],
        );

        assert_eq!(
            result,
            vec![
                "https://example.com/ip".to_owned(),
                "http://example.net/check".to_owned(),
            ]
        );
    }

    #[test]
    fn normalize_endpoint_list_rejects_local_and_private_hosts() {
        let private_ipv4 = [10, 0, 0, 5].map(|part| part.to_string()).join(".");
        let loopback_ipv4 = [127, 0, 0, 1].map(|part| part.to_string()).join(".");

        let result = normalize_endpoint_list(
            vec![
                format!("http://{private_ipv4}/check"),
                format!("http://{loopback_ipv4}/check"),
                "http://localhost/check".to_owned(),
                "https://example.com/check".to_owned(),
            ],
            vec!["https://fallback.example".to_owned()],
        );

        assert_eq!(result, vec!["https://example.com/check".to_owned()]);
    }

    #[test]
    fn normalize_endpoint_list_uses_fallback_when_all_values_are_invalid() {
        let fallback = vec!["https://fallback.example".to_owned()];
        let result = normalize_endpoint_list(vec!["not a url".to_owned()], fallback.clone());

        assert_eq!(result, fallback);
    }
}

