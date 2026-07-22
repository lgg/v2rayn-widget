use tauri::{AppHandle, Emitter, Manager, State};
use tracing::warn;

use crate::{
    adapters::{self, happ, ProxyClientAdapter, RefreshKind},
    models::{
        client::{ClientDescriptor, ClientDiagnostics, ProxyClientId},
        path_validation::PathValidation,
        profile::ProfileSummary,
        settings::{AppSettings, HappSettingsPatch},
        status::DashboardStatus,
    },
    state::app_state::AppState,
    utils::settings_store,
};

const CLIENT_CONTEXT_CHANGED: &str =
    "CLIENT_CONTEXT_CHANGED: selected proxy client changed while the operation was running";

#[tauri::command]
pub async fn get_client_catalog(
    state: State<'_, AppState>,
) -> Result<Vec<ClientDescriptor>, String> {
    Ok(adapters::catalog(&state.snapshot().settings))
}

#[tauri::command]
pub async fn get_selected_client(state: State<'_, AppState>) -> Result<ClientDescriptor, String> {
    let settings = state.snapshot().settings;
    Ok(adapters::descriptor(settings.selected_client, &settings))
}

#[tauri::command]
pub async fn get_selected_client_diagnostics(
    state: State<'_, AppState>,
) -> Result<ClientDiagnostics, String> {
    let client_id = state.snapshot().settings.selected_client;
    adapters::adapter(client_id).diagnostics(state).await
}

#[tauri::command]
pub async fn get_happ_diagnostics(state: State<'_, AppState>) -> Result<ClientDiagnostics, String> {
    adapters::adapter(ProxyClientId::Happ)
        .diagnostics(state)
        .await
}

#[tauri::command]
pub async fn probe_happ_candidate(
    path: Option<String>,
    state: State<'_, AppState>,
) -> Result<ClientDiagnostics, String> {
    let mut settings = state.snapshot().settings;
    settings.happ_path = match path.as_deref().map(str::trim) {
        None | Some("") => None,
        Some(value) => {
            let validation = validate_happ_path_value(value)?;
            if !validation.is_valid {
                return Err(validation.message_key);
            }
            Some(validation.normalized_path)
        }
    };

    let _happ_operation = state.lock_happ_operation().await;
    Ok(happ::diagnostics(&settings))
}

#[tauri::command]
pub async fn open_happ_setup_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("happ-setup")
        .ok_or_else(|| "Happ setup window is not registered".to_owned())?;
    window.show().map_err(|error| error.to_string())?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn select_client(
    client_id: ProxyClientId,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<AppSettings, String> {
    let _settings_update = state.lock_settings_update();
    let mut snapshot = state.snapshot();

    if snapshot.settings.selected_client == client_id {
        return Ok(snapshot.settings);
    }

    snapshot.settings.selected_client = client_id;
    settings_store::save_settings(&snapshot.settings).map_err(|error| error.to_string())?;
    state.replace_settings_and_status(snapshot.settings.clone(), DashboardStatus::default());

    emit_client_settings_events(&app, &snapshot.settings);

    Ok(snapshot.settings)
}

#[tauri::command]
pub async fn detect_happ_path(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let _happ_operation = state.lock_happ_operation().await;
    Ok(happ::detect_available_executable().map(|path| path.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn validate_happ_path(path: String) -> Result<PathValidation, String> {
    validate_happ_path_value(&path)
}

#[tauri::command]
pub async fn update_happ_settings(
    payload: HappSettingsPatch,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppSettings, String> {
    let _happ_operation = state.lock_happ_operation().await;
    let _settings_update = state.lock_settings_update();
    let snapshot = state.snapshot();
    let mut settings = snapshot.settings.clone();

    settings.happ_path = match payload.happ_path.as_deref().map(str::trim) {
        None | Some("") => None,
        Some(value) => {
            let validation = validate_happ_path_value(value)?;
            if !validation.is_valid {
                return Err(validation.message_key);
            }
            Some(validation.normalized_path)
        }
    };
    settings.happ_allow_ui_automation = payload.happ_allow_ui_automation;
    let control_requires_probe = settings.happ_allow_ui_automation
        && (!snapshot.settings.happ_allow_ui_automation
            || settings.happ_path != snapshot.settings.happ_path);

    if control_requires_probe {
        let diagnostics = happ::diagnostics(&settings);
        if !diagnostics.application_running
            || !diagnostics.window_found
            || diagnostics.action_label.is_none()
            || diagnostics.action_score.is_none()
        {
            return Err(
                "HAPP_UI_AUTOMATION_PROBE_REQUIRED: open Happ and run a successful high-confidence probe before enabling experimental control"
                    .to_owned(),
            );
        }
    }

    let latest = state.snapshot();
    let mut final_settings = latest.settings;
    final_settings.happ_path = settings.happ_path;
    final_settings.happ_allow_ui_automation = settings.happ_allow_ui_automation;

    settings_store::save_settings(&final_settings).map_err(|error| error.to_string())?;
    state.replace_settings_and_status_invalidating_context(
        final_settings.clone(),
        if final_settings.selected_client == ProxyClientId::Happ {
            DashboardStatus::default()
        } else {
            latest.status
        },
    );

    emit_client_settings_events(&app, &final_settings);

    Ok(final_settings)
}

fn emit_client_settings_events(app: &AppHandle, settings: &AppSettings) {
    if let Err(error) = app.emit("settings-updated", settings) {
        warn!(
            ?error,
            "failed to emit settings-updated event after client settings persisted"
        );
    }

    if let Err(error) = app.emit(
        "client-selected",
        adapters::descriptor(settings.selected_client, settings),
    ) {
        warn!(
            ?error,
            "failed to emit client-selected event after client settings persisted"
        );
    }
}

fn validate_happ_path_value(path: &str) -> Result<PathValidation, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Ok(PathValidation {
            is_valid: false,
            message_key: "settings.happPathEmpty".to_owned(),
            normalized_path: String::new(),
        });
    }

    Ok(match happ::validate_executable_candidate(trimmed) {
        Some(normalized) => PathValidation {
            is_valid: true,
            message_key: "settings.happPathValid".to_owned(),
            normalized_path: normalized.to_string_lossy().to_string(),
        },
        None => PathValidation {
            is_valid: false,
            message_key: "settings.happPathInvalid".to_owned(),
            normalized_path: trimmed.to_owned(),
        },
    })
}

async fn refresh_with_kind(
    state: State<'_, AppState>,
    kind: RefreshKind,
) -> Result<DashboardStatus, String> {
    let snapshot = state.snapshot();
    let client_id = snapshot.settings.selected_client;
    let client_epoch = snapshot.client_epoch;
    let result = adapters::adapter(client_id)
        .refresh(state.clone(), kind)
        .await?;

    if state.context_matches(client_id, client_epoch) {
        Ok(result)
    } else {
        Err(CLIENT_CONTEXT_CHANGED.to_owned())
    }
}

#[tauri::command]
pub async fn refresh_selected_client(
    state: State<'_, AppState>,
) -> Result<DashboardStatus, String> {
    refresh_with_kind(state, RefreshKind::Foreground).await
}

#[tauri::command]
pub async fn refresh_selected_client_background(
    state: State<'_, AppState>,
) -> Result<DashboardStatus, String> {
    refresh_with_kind(state, RefreshKind::Background).await
}

#[tauri::command]
pub async fn refresh_selected_client_startup(
    state: State<'_, AppState>,
) -> Result<DashboardStatus, String> {
    refresh_with_kind(state, RefreshKind::Startup).await
}

#[tauri::command]
pub async fn refresh_selected_client_post_route(
    state: State<'_, AppState>,
) -> Result<DashboardStatus, String> {
    refresh_with_kind(state, RefreshKind::PostRoute).await
}

#[tauri::command]
pub async fn toggle_selected_client(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    let snapshot = state.snapshot();
    let client_id = snapshot.settings.selected_client;
    let result = adapters::adapter(client_id).toggle(state.clone()).await?;

    if state.context_matches(client_id, snapshot.client_epoch) {
        Ok(result)
    } else {
        Err(CLIENT_CONTEXT_CHANGED.to_owned())
    }
}

#[tauri::command]
pub async fn list_selected_client_items(
    state: State<'_, AppState>,
) -> Result<Vec<ProfileSummary>, String> {
    let snapshot = state.snapshot();
    let client_id = snapshot.settings.selected_client;
    let result = adapters::adapter(client_id)
        .list_items(state.clone())
        .await?;

    if state.context_matches(client_id, snapshot.client_epoch) {
        Ok(result)
    } else {
        Err(CLIENT_CONTEXT_CHANGED.to_owned())
    }
}

#[tauri::command]
pub async fn select_client_item(
    item_id: String,
    state: State<'_, AppState>,
) -> Result<DashboardStatus, String> {
    let snapshot = state.snapshot();
    let client_id = snapshot.settings.selected_client;
    let result = adapters::adapter(client_id)
        .select_item(item_id, state.clone())
        .await?;

    if state.context_matches(client_id, snapshot.client_epoch) {
        Ok(result)
    } else {
        Err(CLIENT_CONTEXT_CHANGED.to_owned())
    }
}

#[tauri::command]
pub async fn open_selected_client(state: State<'_, AppState>) -> Result<(), String> {
    let client_id = state.snapshot().settings.selected_client;
    adapters::adapter(client_id).open(state).await
}
