use std::{
    path::{Path, PathBuf},
    process::Command,
    time::{Duration, Instant},
};

use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, State, Url, WebviewUrl, WebviewWindowBuilder,
};
use tracing::{error, info, warn};

use crate::{
    models::{
        client::ProxyClientId,
        debug::{DebugRuntimeSnapshot, UiDebugReport},
        locale::LocaleInfo,
        path_validation::PathValidation,
        profile::ProfileSummary,
        settings::{
            default_diagnostics_url, AppSettings, LatencyMode, UiSettingsPatch, V2RayNPathMode,
        },
        status::{ConnectionState, DashboardStatus},
    },
    services::{
        config_reader,
        health_check::{self, HealthCheckOptions},
        log_reader, privilege, process_monitor,
        status_service::{self, StatusInputs},
        ui_controller,
    },
    state::app_state::AppState,
    utils::{
        app_paths, autostart,
        settings_normalization::{
            normalize_diagnostics_url, normalize_endpoint_list, normalize_optional_path,
            normalize_settings,
        },
        settings_store,
    },
};

const UIPI_MISMATCH_PREFIX: &str = "UIPI_MISMATCH";
const PROFILE_IP_SETTLE_DELAY: Duration = Duration::from_secs(5);
const UI_CONFIRM_TIMEOUT: Duration = Duration::from_secs(3);
const UI_CONFIRM_POLL_INTERVAL: Duration = Duration::from_millis(150);
const PROCESS_EXIT_TIMEOUT: Duration = Duration::from_secs(8);
const PROCESS_START_TIMEOUT: Duration = Duration::from_secs(8);
const PROCESS_POLL_INTERVAL: Duration = Duration::from_millis(150);

#[tauri::command]
pub async fn get_status(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    Ok(state.snapshot().status)
}

#[tauri::command]
pub async fn refresh_status(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    let requested_context = state.snapshot();
    let _v2rayn_operation = state.lock_v2rayn_operation().await;
    if !state.context_matches(ProxyClientId::V2rayn, requested_context.client_epoch) {
        return Err(
            "CLIENT_CONTEXT_CHANGED: selected proxy client changed before the v2rayN operation started"
                .to_owned(),
        );
    }
    let snapshot = state.snapshot();

    if snapshot.settings.mock_mode_enabled {
        let mock = build_mock_status(&snapshot.status, &snapshot.settings, None, None);
        return commit_client_status(&state, ProxyClientId::V2rayn, snapshot.client_epoch, mock);
    }

    let status = refresh_status_from_settings(&snapshot.settings, true, true, false)
        .await
        .map_err(|error| {
            error!(?error, "refresh_status failed");
            error.to_string()
        })?;

    let merged = merge_with_previous(status, &snapshot.status);
    commit_client_status(&state, ProxyClientId::V2rayn, snapshot.client_epoch, merged)
}

#[tauri::command]
pub async fn refresh_status_post_route(
    state: State<'_, AppState>,
) -> Result<DashboardStatus, String> {
    let requested_context = state.snapshot();
    let _v2rayn_operation = state.lock_v2rayn_operation().await;
    if !state.context_matches(ProxyClientId::V2rayn, requested_context.client_epoch) {
        return Err(
            "CLIENT_CONTEXT_CHANGED: selected proxy client changed before the v2rayN operation started"
                .to_owned(),
        );
    }
    let snapshot = state.snapshot();

    if snapshot.settings.mock_mode_enabled {
        let mock = build_mock_status(&snapshot.status, &snapshot.settings, None, None);
        return commit_client_status(&state, ProxyClientId::V2rayn, snapshot.client_epoch, mock);
    }

    let status = refresh_status_from_settings(&snapshot.settings, false, true, false)
        .await
        .map_err(|error| {
            error!(?error, "refresh_status_post_route failed");
            error.to_string()
        })?;

    let merged = merge_with_previous(status, &snapshot.status);
    commit_client_status(&state, ProxyClientId::V2rayn, snapshot.client_epoch, merged)
}
#[tauri::command]
pub async fn refresh_status_background(
    state: State<'_, AppState>,
) -> Result<DashboardStatus, String> {
    let requested_context = state.snapshot();
    let _v2rayn_operation = state.lock_v2rayn_operation().await;
    if !state.context_matches(ProxyClientId::V2rayn, requested_context.client_epoch) {
        return Err(
            "CLIENT_CONTEXT_CHANGED: selected proxy client changed before the v2rayN operation started"
                .to_owned(),
        );
    }
    let snapshot = state.snapshot();

    if snapshot.settings.mock_mode_enabled {
        let mock = build_mock_status(&snapshot.status, &snapshot.settings, None, None);
        return commit_client_status(&state, ProxyClientId::V2rayn, snapshot.client_epoch, mock);
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
                error!(
                    ?error,
                    "refresh_status_background profile-change external-ip refresh failed"
                );
                error.to_string()
            })?;

        merged = merge_with_previous(with_external_ip, &merged);
    }

    commit_client_status(&state, ProxyClientId::V2rayn, snapshot.client_epoch, merged)
}

#[tauri::command]
pub async fn refresh_status_startup(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    let requested_context = state.snapshot();
    let _v2rayn_operation = state.lock_v2rayn_operation().await;
    if !state.context_matches(ProxyClientId::V2rayn, requested_context.client_epoch) {
        return Err(
            "CLIENT_CONTEXT_CHANGED: selected proxy client changed before the v2rayN operation started"
                .to_owned(),
        );
    }
    let snapshot = state.snapshot();

    if snapshot.settings.mock_mode_enabled {
        let mock = build_mock_status(&snapshot.status, &snapshot.settings, None, None);
        return commit_client_status(&state, ProxyClientId::V2rayn, snapshot.client_epoch, mock);
    }

    let status = refresh_status_from_settings(&snapshot.settings, true, true, true)
        .await
        .map_err(|error| {
            error!(?error, "refresh_status_startup failed");
            error.to_string()
        })?;

    let merged = merge_with_previous(status, &snapshot.status);
    commit_client_status(&state, ProxyClientId::V2rayn, snapshot.client_epoch, merged)
}

#[tauri::command]
pub async fn toggle_tun_via_ui(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    let requested_context = state.snapshot();
    let _v2rayn_operation = state.lock_v2rayn_operation().await;
    if !state.context_matches(ProxyClientId::V2rayn, requested_context.client_epoch) {
        return Err(
            "CLIENT_CONTEXT_CHANGED: selected proxy client changed before the v2rayN operation started"
                .to_owned(),
        );
    }
    let snapshot = state.snapshot();

    if snapshot.settings.mock_mode_enabled {
        let mock = build_mock_status(
            &snapshot.status,
            &snapshot.settings,
            Some(!snapshot.status.tun_enabled),
            None,
        );
        return commit_client_status(&state, ProxyClientId::V2rayn, snapshot.client_epoch, mock);
    }

    let allow_restart_fallback = snapshot.settings.allow_restart_fallback;
    let base_path = resolve_v2rayn_base_path(&snapshot.settings)
        .ok_or_else(|| "v2rayN path not found".to_owned())?;
    let target_pid = selected_v2rayn_window_pid(&base_path);
    if target_pid.is_some() {
        ensure_uipi_compatible_for_control(target_pid)?;
    }

    let before = config_reader::read_primary_config(&base_path)
        .map_err(|error| format!("Could not read primary config before UI toggle: {error}"))?
        .enable_tun
        .ok_or_else(|| {
            "Primary config does not expose a boolean EnableTun value; refusing an unconfirmable UI toggle"
                .to_owned()
        })?;

    let automation_result = ui_controller::toggle_tun_via_ui(target_pid);
    let after_ui = if automation_result.is_ok() {
        wait_for_tun_state_change(&base_path, before).await
    } else {
        config_reader::read_primary_config(&base_path)
            .ok()
            .and_then(|cfg| cfg.enable_tun)
    };

    let need_fallback =
        automation_result.is_err() || !tun_state_change_confirmed(Some(before), after_ui);

    if need_fallback {
        if !allow_restart_fallback {
            return Err(
                "UI toggle did not apply and restart fallback is disabled in Settings".to_owned(),
            );
        }

        if let Err(error) = &automation_result {
            warn!(?error, "UI toggle failed, using config fallback");
        } else {
            warn!(
                ?before,
                ?after_ui,
                "UI toggle did not change config state, using fallback"
            );
        }

        let process_snapshot =
            process_monitor::read_process_snapshot_for_base_path(Some(&base_path));
        if process_snapshot.v2rayn_running {
            ensure_v2rayn_processes_restartable(&process_snapshot.v2rayn_pids)?;
        }

        let expected_enable_tun = !before;
        config_reader::set_tun_mode(&base_path, expected_enable_tun)
            .map_err(|error| format!("toggle failed (fallback): {error}"))?;

        if process_snapshot.v2rayn_running {
            restart_v2rayn_process(&base_path).await.map_err(|error| {
                format!(
                    "toggle fallback set EnableTun={expected_enable_tun} but restart failed: {error}"
                )
            })?;
        }
    }

    let status = refresh_status_after_route_change(&snapshot.settings, &snapshot.status)
        .await
        .map_err(|error| {
            error!(?error, "status refresh after toggle failed");
            error.to_string()
        })?;

    let merged = merge_with_previous(status, &snapshot.status);
    commit_client_status(&state, ProxyClientId::V2rayn, snapshot.client_epoch, merged)
}

#[tauri::command]
pub async fn set_active_profile(
    profile_id: String,
    state: State<'_, AppState>,
) -> Result<DashboardStatus, String> {
    let requested_context = state.snapshot();
    let _v2rayn_operation = state.lock_v2rayn_operation().await;
    if !state.context_matches(ProxyClientId::V2rayn, requested_context.client_epoch) {
        return Err(
            "CLIENT_CONTEXT_CHANGED: selected proxy client changed before the v2rayN operation started"
                .to_owned(),
        );
    }
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
        return commit_client_status(&state, ProxyClientId::V2rayn, snapshot.client_epoch, mock);
    }

    let allow_restart_fallback = snapshot.settings.allow_restart_fallback;
    let base_path = resolve_v2rayn_base_path(&snapshot.settings)
        .ok_or_else(|| "v2rayN path not found".to_owned())?;
    let target_pid = selected_v2rayn_window_pid(&base_path);
    if target_pid.is_some() {
        ensure_uipi_compatible_for_control(target_pid)?;
    }

    let config_before = config_reader::read_primary_config(&base_path).map_err(|error| {
        error!(?error, "set_active_profile: primary config read failed");
        error.to_string()
    })?;

    let target_profile = config_before
        .profiles
        .iter()
        .find(|item| item.id == requested_profile_id)
        .cloned()
        .ok_or_else(|| format!("Profile not found: {requested_profile_id}"))?;

    if profile_name_matches(
        config_before.active_profile_name.as_deref(),
        &target_profile.name,
    ) {
        let status = refresh_status_from_settings(&snapshot.settings, true, true, true)
            .await
            .map_err(|error| {
                error!(
                    ?error,
                    "status refresh after set_active_profile no-op failed"
                );
                error.to_string()
            })?;

        let merged = merge_with_previous(status, &snapshot.status);
        return commit_client_status(&state, ProxyClientId::V2rayn, snapshot.client_epoch, merged);
    }

    let process_snapshot = process_monitor::read_process_snapshot_for_base_path(Some(&base_path));
    let mut applied_via_ui = false;

    if process_snapshot.v2rayn_running {
        match ui_controller::set_active_profile_via_ui(&target_profile.name, target_pid) {
            Ok(note) => {
                info!(%note, target_profile = %target_profile.name, "UI profile switch attempt executed");
                let after_ui = wait_for_profile_name(&base_path, &target_profile.name).await;

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
            return Err(
                "UI profile switch did not apply and restart fallback is disabled in Settings"
                    .to_owned(),
            );
        }

        let process_snapshot =
            process_monitor::read_process_snapshot_for_base_path(Some(&base_path));
        if process_snapshot.v2rayn_running {
            ensure_v2rayn_processes_restartable(&process_snapshot.v2rayn_pids)?;
        }

        config_reader::set_active_profile(&base_path, &requested_profile_id).map_err(|error| {
            error!(?error, "set_active_profile fallback config write failed");
            error.to_string()
        })?;

        if process_snapshot.v2rayn_running {
            restart_v2rayn_process(&base_path).await.map_err(|error| {
                error!(?error, "restart after profile change fallback failed");
                error.to_string()
            })?;
        }
    }

    let status = refresh_status_after_route_change(&snapshot.settings, &snapshot.status)
        .await
        .map_err(|error| {
            error!(?error, "status refresh after set_active_profile failed");
            error.to_string()
        })?;

    let merged = merge_with_previous(status, &snapshot.status);
    commit_client_status(&state, ProxyClientId::V2rayn, snapshot.client_epoch, merged)
}

#[tauri::command]
pub async fn open_v2rayn(state: State<'_, AppState>) -> Result<(), String> {
    let requested_context = state.snapshot();
    let _v2rayn_operation = state.lock_v2rayn_operation().await;
    if !state.context_matches(ProxyClientId::V2rayn, requested_context.client_epoch) {
        return Err(
            "CLIENT_CONTEXT_CHANGED: selected proxy client changed before the v2rayN operation started"
                .to_owned(),
        );
    }
    let settings = state.snapshot().settings;
    let base_path =
        resolve_v2rayn_base_path(&settings).ok_or_else(|| "v2rayN path not found".to_owned())?;

    open_v2rayn_process(&base_path).await
}

#[tauri::command]
pub async fn restart_v2rayn(state: State<'_, AppState>) -> Result<(), String> {
    let requested_context = state.snapshot();
    let _v2rayn_operation = state.lock_v2rayn_operation().await;
    if !state.context_matches(ProxyClientId::V2rayn, requested_context.client_epoch) {
        return Err(
            "CLIENT_CONTEXT_CHANGED: selected proxy client changed before the v2rayN operation started"
                .to_owned(),
        );
    }
    let settings = state.snapshot().settings;
    let base_path =
        resolve_v2rayn_base_path(&settings).ok_or_else(|| "v2rayN path not found".to_owned())?;

    restart_v2rayn_process(&base_path)
        .await
        .map_err(|error| error.to_string())
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
    let _settings_update = state.lock_settings_update();
    let snapshot = state.snapshot();
    let settings = merge_general_settings_payload(payload, &snapshot.settings);
    let status = if snapshot.settings.mock_mode_enabled != settings.mock_mode_enabled {
        if settings.mock_mode_enabled {
            build_mock_status(&snapshot.status, &settings, None, None)
        } else {
            DashboardStatus::default()
        }
    } else {
        snapshot.status
    };

    apply_runtime_settings_delta(&app, &snapshot.settings, &settings)?;
    if let Err(error) = settings_store::save_settings(&settings) {
        rollback_runtime_settings_delta(&app, &settings, &snapshot.settings);
        return Err(error.to_string());
    }
    state.replace_settings_and_status_invalidating_context(settings.clone(), status);

    emit_settings_updated(&app, &settings);

    Ok(settings)
}

#[tauri::command]
pub async fn apply_ui_settings(
    payload: UiSettingsPatch,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppSettings, String> {
    let _settings_update = state.lock_settings_update();
    let snapshot = state.snapshot();
    let previous_settings = snapshot.settings;
    let previous_mock_mode = previous_settings.mock_mode_enabled;
    let previous_status = snapshot.status;
    let mut merged = previous_settings.clone();

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

    apply_runtime_settings_delta(&app, &previous_settings, &settings)?;
    if let Err(error) = settings_store::save_settings(&settings) {
        rollback_runtime_settings_delta(&app, &settings, &previous_settings);
        return Err(error.to_string());
    }
    if previous_mock_mode != settings.mock_mode_enabled {
        let status = if settings.mock_mode_enabled {
            build_mock_status(&previous_status, &settings, None, None)
        } else {
            DashboardStatus::default()
        };
        state.replace_settings_and_status_invalidating_context(settings.clone(), status);
    } else {
        state.update_settings(settings.clone());
    }

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
pub async fn open_diagnostics_window(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let settings = state.snapshot().settings;
    if !settings.diagnostics_enabled {
        return Err("Diagnostics page is disabled".to_owned());
    }

    let url = normalize_diagnostics_url(&settings.diagnostics_url).unwrap_or_else(|| {
        Url::parse(&default_diagnostics_url()).expect("default diagnostics URL is valid")
    });

    if let Some(window) = app.get_webview_window("diagnostics") {
        window.navigate(url).map_err(|error| error.to_string())?;
        window.show().map_err(|error| error.to_string())?;
        window.unminimize().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, "diagnostics", WebviewUrl::External(url))
        .title("Diagnostics")
        .inner_size(1100.0, 780.0)
        .min_inner_size(760.0, 520.0)
        .resizable(true)
        .decorations(true)
        .always_on_top(settings.always_on_top)
        .visible(true)
        .build()
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn run_ui_debug_probe(state: State<'_, AppState>) -> Result<UiDebugReport, String> {
    let settings = state.snapshot().settings;
    let target_pid = resolve_v2rayn_base_path(&settings)
        .as_deref()
        .and_then(selected_v2rayn_window_pid);
    let mut report = ui_controller::debug_probe(target_pid).map_err(|error| error.to_string())?;

    if report.window_process_name.is_none() {
        if let Some(pid) = report.window_pid {
            report.window_process_name = process_monitor::process_name_by_pid(pid);
        }
    }

    if let Ok(diag) =
        privilege::collect_v2rayn_privilege_diagnostics(report.window_pid.or(target_pid))
    {
        report.privilege = diag;
    }

    Ok(report)
}

#[tauri::command]
pub async fn debug_toggle_via_ui_only(state: State<'_, AppState>) -> Result<String, String> {
    let requested_context = state.snapshot();
    let _v2rayn_operation = state.lock_v2rayn_operation().await;
    if !state.context_matches(ProxyClientId::V2rayn, requested_context.client_epoch) {
        return Err(
            "CLIENT_CONTEXT_CHANGED: selected proxy client changed before the v2rayN operation started"
                .to_owned(),
        );
    }
    let target_pid = selected_v2rayn_window_pid_from_state(&state)?;
    ensure_uipi_compatible_for_control(Some(target_pid))?;
    ui_controller::debug_toggle_via_ui_only(Some(target_pid)).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn debug_click_reload_via_ui(state: State<'_, AppState>) -> Result<String, String> {
    let requested_context = state.snapshot();
    let _v2rayn_operation = state.lock_v2rayn_operation().await;
    if !state.context_matches(ProxyClientId::V2rayn, requested_context.client_epoch) {
        return Err(
            "CLIENT_CONTEXT_CHANGED: selected proxy client changed before the v2rayN operation started"
                .to_owned(),
        );
    }
    let target_pid = selected_v2rayn_window_pid_from_state(&state)?;
    ensure_uipi_compatible_for_control(Some(target_pid))?;
    ui_controller::debug_click_reload_via_ui_only(Some(target_pid))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn debug_select_profile_via_ui(
    profile_name: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let requested_context = state.snapshot();
    let _v2rayn_operation = state.lock_v2rayn_operation().await;
    if !state.context_matches(ProxyClientId::V2rayn, requested_context.client_epoch) {
        return Err(
            "CLIENT_CONTEXT_CHANGED: selected proxy client changed before the v2rayN operation started"
                .to_owned(),
        );
    }
    let target_pid = selected_v2rayn_window_pid_from_state(&state)?;
    ensure_uipi_compatible_for_control(Some(target_pid))?;
    ui_controller::debug_select_profile_via_ui_only(profile_name.trim(), Some(target_pid))
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
    let requested_context = state.snapshot();
    let _v2rayn_operation = state.lock_v2rayn_operation().await;
    if !state.context_matches(ProxyClientId::V2rayn, requested_context.client_epoch) {
        return Err(
            "CLIENT_CONTEXT_CHANGED: selected proxy client changed before the v2rayN operation started"
                .to_owned(),
        );
    }
    let settings = state.snapshot().settings;
    let base_path =
        resolve_v2rayn_base_path(&settings).ok_or_else(|| "v2rayN path not found".to_owned())?;

    let process_snapshot = process_monitor::read_process_snapshot_for_base_path(Some(&base_path));
    if process_snapshot.v2rayn_running {
        ensure_v2rayn_processes_restartable(&process_snapshot.v2rayn_pids)?;
    }

    let value = config_reader::toggle_tun_mode(&base_path).map_err(|error| error.to_string())?;

    if process_snapshot.v2rayn_running {
        restart_v2rayn_process(&base_path)
            .await
            .map_err(|error| format!("Config changed but restart failed: {error}"))?;
        return Ok(format!(
            "Config EnableTun set to {value}. The selected v2rayN installation was restarted."
        ));
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
    let requested_context = state.snapshot();
    let _v2rayn_operation = state.lock_v2rayn_operation().await;
    if !state.context_matches(ProxyClientId::V2rayn, requested_context.client_epoch) {
        return Err(
            "CLIENT_CONTEXT_CHANGED: selected proxy client changed before the v2rayN operation started"
                .to_owned(),
        );
    }
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
    if !matches!(
        label.as_str(),
        "main" | "settings" | "debug" | "happ-setup" | "diagnostics"
    ) {
        return Err(format!(
            "Window cannot be hidden through this command: {label}"
        ));
    }

    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("Window not found: {label}"))?;

    window.hide().map_err(|error| error.to_string())?;

    if label != "main" {
        if let Some(main) = app.get_webview_window("main") {
            main.show().map_err(|error| error.to_string())?;
            main.unminimize().map_err(|error| error.to_string())?;
            main.set_focus().map_err(|error| error.to_string())?;
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

    let process = process_monitor::read_process_snapshot_for_base_path(Some(&base_path));

    let effective_latency_mode = if force_full_probe {
        LatencyMode::Active
    } else {
        settings.latency_mode.clone()
    };

    let check_latency = include_latency_probe && (settings.show_latency || force_full_probe);
    let check_external_ip =
        include_external_ip_probe && (settings.show_external_ip || force_full_probe);

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
    let base_path = resolve_v2rayn_base_path(settings);
    let process = process_monitor::read_process_snapshot_for_base_path(base_path.as_deref());
    let mut snapshot = DebugRuntimeSnapshot {
        v2rayn_running: process.v2rayn_running,
        v2rayn_pid: process.v2rayn_pid,
        ..DebugRuntimeSnapshot::default()
    };

    if let Some(base_path) = base_path {
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

pub(crate) fn resolve_v2rayn_base_path(settings: &AppSettings) -> Option<PathBuf> {
    match settings.v2rayn_path_mode {
        V2RayNPathMode::Manual => normalize_optional_path(settings.v2rayn_path.clone())
            .map(PathBuf::from)
            .filter(|path| app_paths::is_valid_v2rayn_path(path)),
        V2RayNPathMode::Auto => detect_v2rayn_path_best_effort(),
    }
    .or_else(|| {
        normalize_optional_path(settings.v2rayn_path.clone())
            .as_deref()
            .map(Path::new)
            .filter(|path| app_paths::is_valid_v2rayn_path(path))
            .map(Path::to_path_buf)
    })
}

fn merge_general_settings_payload(payload: AppSettings, current: &AppSettings) -> AppSettings {
    let mut settings = normalize_settings(payload);

    // This payload is owned by the general settings window. Preserve fields that
    // are managed by client selection, Happ setup, or live window tracking so a
    // stale draft cannot overwrite newer state from another window.
    settings.selected_client = current.selected_client;
    settings.happ_path = current.happ_path.clone();
    settings.happ_allow_ui_automation = current.happ_allow_ui_automation;
    settings.window_position = current.window_position.clone();
    settings
}

fn profile_name_matches(current: Option<&str>, expected: &str) -> bool {
    let current = current
        .map(|value| value.trim().to_lowercase())
        .unwrap_or_default();
    let expected = expected.trim().to_lowercase();

    if current.is_empty() || expected.is_empty() {
        return false;
    }

    current == expected
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

    let active_profile_name = profile_override
        .or_else(|| {
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

fn commit_client_status(
    state: &State<'_, AppState>,
    client_id: ProxyClientId,
    client_epoch: u64,
    status: DashboardStatus,
) -> Result<DashboardStatus, String> {
    if state.update_status_if_context(client_id, client_epoch, status.clone()) {
        Ok(status)
    } else {
        Err(
            "CLIENT_CONTEXT_CHANGED: selected proxy client changed while the operation was running"
                .to_owned(),
        )
    }
}

async fn wait_for_tun_state_change(base_path: &Path, before: bool) -> Option<bool> {
    let deadline = Instant::now() + UI_CONFIRM_TIMEOUT;
    loop {
        let observed = config_reader::read_primary_config(base_path)
            .ok()
            .and_then(|config| config.enable_tun);
        if tun_state_change_confirmed(Some(before), observed) || Instant::now() >= deadline {
            return observed;
        }
        tokio::time::sleep(UI_CONFIRM_POLL_INTERVAL).await;
    }
}

fn tun_state_change_confirmed(before: Option<bool>, after: Option<bool>) -> bool {
    matches!((before, after), (Some(previous), Some(current)) if previous != current)
}

async fn wait_for_profile_name(base_path: &Path, expected_name: &str) -> Option<String> {
    let deadline = Instant::now() + UI_CONFIRM_TIMEOUT;
    loop {
        let observed = config_reader::read_primary_config(base_path)
            .ok()
            .and_then(|config| config.active_profile_name);
        if profile_name_matches(observed.as_deref(), expected_name) || Instant::now() >= deadline {
            return observed;
        }
        tokio::time::sleep(UI_CONFIRM_POLL_INTERVAL).await;
    }
}

fn selected_v2rayn_window_pid(base_path: &Path) -> Option<u32> {
    let snapshot = process_monitor::read_process_snapshot_for_base_path(Some(base_path));
    ui_controller::find_v2rayn_window_pid(&snapshot.v2rayn_pids)
}

fn selected_v2rayn_window_pid_from_state(state: &State<'_, AppState>) -> Result<u32, String> {
    let settings = state.snapshot().settings;
    let base_path =
        resolve_v2rayn_base_path(&settings).ok_or_else(|| "v2rayN path not found".to_owned())?;
    selected_v2rayn_window_pid(&base_path)
        .ok_or_else(|| "v2rayN window not found for the configured installation".to_owned())
}

fn ensure_v2rayn_processes_restartable(target_pids: &[u32]) -> Result<(), String> {
    for pid in target_pids {
        let diagnostics = privilege::collect_v2rayn_privilege_diagnostics(Some(*pid)).map_err(
            |error| {
                format!(
                    "Could not verify permissions for v2rayN PID {pid}; refusing to mutate config before restart: {error}"
                )
            },
        )?;

        if diagnostics.uipi_mismatch {
            return Err(format!(
                "{UIPI_MISMATCH_PREFIX}: v2rayN is running as Administrator (PID {pid}), but widget is running without Administrator rights. Refusing to mutate config because the selected installation cannot be restarted safely."
            ));
        }
    }

    Ok(())
}

fn ensure_uipi_compatible_for_control(target_pid: Option<u32>) -> Result<(), String> {
    let diagnostics = match privilege::collect_v2rayn_privilege_diagnostics(target_pid) {
        Ok(diagnostics) => diagnostics,
        Err(error) => {
            warn!(?error, "privilege diagnostics failed");
            return Ok(());
        }
    };

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

fn build_v2rayn_command(base_path: &Path) -> Command {
    let mut command = Command::new(base_path.join("v2rayN.exe"));
    command.current_dir(base_path);
    command
}

async fn open_v2rayn_process(base_path: &Path) -> Result<(), String> {
    let existing = process_monitor::read_process_snapshot_for_base_path(Some(base_path));
    if existing.v2rayn_running {
        ui_controller::activate_v2rayn_window(&existing.v2rayn_pids).map_err(|error| {
            format!(
                "v2rayN is already running for {}, but its window could not be activated; refusing to launch a duplicate instance: {error}",
                base_path.display()
            )
        })?;
        info!(base_path = %base_path.display(), "activated existing v2rayN window");
        return Ok(());
    }

    build_v2rayn_command(base_path)
        .spawn()
        .map_err(|error| error.to_string())?;

    if !wait_for_v2rayn_running_state(base_path, true, PROCESS_START_TIMEOUT).await {
        return Err(format!(
            "v2rayN was launched from {}, but no matching process became available before the startup timeout",
            base_path.display()
        ));
    }

    info!(base_path = %base_path.display(), "open_v2rayn requested");
    Ok(())
}

async fn restart_v2rayn_process(base_path: &Path) -> anyhow::Result<()> {
    let matched = process_monitor::terminate_v2rayn_at_path(base_path)?;
    if matched {
        if !wait_for_v2rayn_running_state(base_path, false, PROCESS_EXIT_TIMEOUT).await {
            anyhow::bail!(
                "Matched v2rayN process did not terminate before the timeout; refusing to launch a duplicate instance"
            );
        }
    } else {
        warn!(
            base_path = %base_path.display(),
            "no running v2rayN process matched configured path during restart"
        );
    }

    open_v2rayn_process(base_path)
        .await
        .map_err(anyhow::Error::msg)
}

async fn wait_for_v2rayn_running_state(
    base_path: &Path,
    expected_running: bool,
    timeout: Duration,
) -> bool {
    let deadline = Instant::now() + timeout;
    loop {
        let running =
            process_monitor::read_process_snapshot_for_base_path(Some(base_path)).v2rayn_running;
        if running == expected_running {
            return true;
        }
        if Instant::now() >= deadline {
            return false;
        }
        tokio::time::sleep(PROCESS_POLL_INTERVAL).await;
    }
}

fn apply_runtime_settings_delta(
    app: &AppHandle,
    previous: &AppSettings,
    next: &AppSettings,
) -> Result<(), String> {
    let always_on_top_changed = previous.always_on_top != next.always_on_top;
    let autostart_changed = previous.autostart_with_windows != next.autostart_with_windows;

    if always_on_top_changed {
        set_all_windows_always_on_top(app, next.always_on_top).map_err(|error| {
            let _ = set_all_windows_always_on_top(app, previous.always_on_top);
            error
        })?;
    }

    if autostart_changed {
        if let Err(error) = autostart::apply_autostart(next.autostart_with_windows) {
            if always_on_top_changed {
                let _ = set_all_windows_always_on_top(app, previous.always_on_top);
            }
            return Err(error.to_string());
        }
    }

    Ok(())
}

fn rollback_runtime_settings_delta(app: &AppHandle, applied: &AppSettings, previous: &AppSettings) {
    if applied.always_on_top != previous.always_on_top {
        if let Err(error) = set_all_windows_always_on_top(app, previous.always_on_top) {
            warn!(
                ?error,
                "failed to roll back always-on-top after settings persistence failure"
            );
        }
    }

    if applied.autostart_with_windows != previous.autostart_with_windows {
        if let Err(error) = autostart::apply_autostart(previous.autostart_with_windows) {
            warn!(
                ?error,
                "failed to roll back autostart after settings persistence failure"
            );
        }
    }
}

fn set_all_windows_always_on_top(app: &AppHandle, value: bool) -> Result<(), String> {
    for label in ["main", "settings", "debug", "happ-setup", "diagnostics"] {
        if let Some(window) = app.get_webview_window(label) {
            window.set_always_on_top(value).map_err(|error| {
                format!("Could not update always-on-top for window '{label}': {error}")
            })?;
        }
    }
    Ok(())
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

    window.show().map_err(|error| error.to_string())?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn general_settings_payload_preserves_adapter_owned_fields() {
        let current = AppSettings {
            selected_client: ProxyClientId::Happ,
            happ_path: Some("C:\\Happ\\Happ.exe".to_owned()),
            happ_allow_ui_automation: true,
            window_position: Some(crate::models::settings::WindowPosition {
                x: 10,
                y: 20,
                width: 360,
                height: 500,
            }),
            ..AppSettings::default()
        };

        let stale_payload = AppSettings {
            selected_client: ProxyClientId::V2rayn,
            happ_path: None,
            happ_allow_ui_automation: false,
            window_position: None,
            ..AppSettings::default()
        };

        let merged = merge_general_settings_payload(stale_payload, &current);
        assert_eq!(merged.selected_client, ProxyClientId::Happ);
        assert_eq!(merged.happ_path, current.happ_path);
        assert!(merged.happ_allow_ui_automation);
        assert_eq!(merged.window_position, current.window_position);
    }

    #[test]
    fn profile_name_match_requires_exact_normalized_name() {
        assert!(profile_name_matches(
            Some("  Demo Profile  "),
            "demo profile"
        ));
        assert!(!profile_name_matches(Some("RUSSIAN"), "US"));
        assert!(!profile_name_matches(Some("US"), "RUSSIAN"));
        assert!(!profile_name_matches(None, "demo"));
        assert!(!profile_name_matches(Some("demo"), ""));
    }

    #[test]
    fn tun_ui_result_requires_an_observable_state_change() {
        assert!(tun_state_change_confirmed(Some(false), Some(true)));
        assert!(tun_state_change_confirmed(Some(true), Some(false)));
        assert!(!tun_state_change_confirmed(None, Some(true)));
        assert!(!tun_state_change_confirmed(Some(true), Some(true)));
        assert!(!tun_state_change_confirmed(Some(false), None));
        assert!(!tun_state_change_confirmed(None, None));
    }

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
                "http://router.local/check".to_owned(),
                "http://service.internal/check".to_owned(),
                "http://100.64.0.1/check".to_owned(),
                "http://224.0.0.1/check".to_owned(),
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

    #[test]
    fn normalize_diagnostics_url_defaults_and_accepts_bare_hosts() {
        assert_eq!(
            normalize_diagnostics_url("").map(|url| url.to_string()),
            Some("https://ipleak.net/".to_owned())
        );
        assert_eq!(
            normalize_diagnostics_url("browserleaks.com/ip").map(|url| url.to_string()),
            Some("https://browserleaks.com/ip".to_owned())
        );
    }

    #[test]
    fn normalize_diagnostics_url_rejects_non_http_schemes() {
        assert!(normalize_diagnostics_url("file:///C:/temp/check.html").is_none());
        assert!(normalize_diagnostics_url("javascript:alert(1)").is_none());
    }
    #[test]
    fn v2rayn_command_uses_selected_installation_as_working_directory() {
        let base_path = PathBuf::from("selected-v2rayn-installation");
        let command = build_v2rayn_command(&base_path);

        assert_eq!(command.get_current_dir(), Some(base_path.as_path()));
        assert_eq!(
            PathBuf::from(command.get_program()),
            base_path.join("v2rayN.exe")
        );
    }
}
