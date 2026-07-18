use tauri::{AppHandle, Emitter, State};

use crate::{
    adapters::{self, happ, v2rayn},
    models::{
        client::{ClientDescriptor, ProxyClientId},
        path_validation::PathValidation,
        profile::ProfileSummary,
        settings::AppSettings,
        status::DashboardStatus,
    },
    state::app_state::AppState,
    utils::settings_store,
};

#[tauri::command]
pub async fn get_client_catalog() -> Result<Vec<ClientDescriptor>, String> {
    Ok(adapters::catalog())
}

#[tauri::command]
pub async fn get_selected_client(state: State<'_, AppState>) -> Result<ClientDescriptor, String> {
    Ok(adapters::descriptor(
        state.snapshot().settings.selected_client,
    ))
}

#[tauri::command]
pub async fn select_client(
    client_id: ProxyClientId,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<AppSettings, String> {
    let mut snapshot = state.snapshot();

    if snapshot.settings.selected_client == client_id {
        return Ok(snapshot.settings);
    }

    snapshot.settings.selected_client = client_id;
    settings_store::save_settings(&snapshot.settings).map_err(|error| error.to_string())?;
    state.update_settings(snapshot.settings.clone());
    state.update_status(DashboardStatus::default());

    app.emit("settings-updated", &snapshot.settings)
        .map_err(|error| error.to_string())?;
    app.emit("client-selected", adapters::descriptor(client_id))
        .map_err(|error| error.to_string())?;

    Ok(snapshot.settings)
}

#[tauri::command]
pub async fn detect_happ_path(state: State<'_, AppState>) -> Result<Option<String>, String> {
    Ok(happ::detect_executable(&state.snapshot().settings)
        .map(|path| path.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn validate_happ_path(path: String) -> Result<PathValidation, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Ok(PathValidation {
            is_valid: false,
            message_key: "settings.happPathEmpty".to_owned(),
            normalized_path: String::new(),
        });
    }

    match happ::validate_executable_candidate(trimmed) {
        Some(normalized) => Ok(PathValidation {
            is_valid: true,
            message_key: "settings.happPathValid".to_owned(),
            normalized_path: normalized.to_string_lossy().to_string(),
        }),
        None => Ok(PathValidation {
            is_valid: false,
            message_key: "settings.happPathInvalid".to_owned(),
            normalized_path: trimmed.to_owned(),
        }),
    }
}

#[tauri::command]
pub async fn refresh_selected_client(
    state: State<'_, AppState>,
) -> Result<DashboardStatus, String> {
    let snapshot = state.snapshot();
    match snapshot.settings.selected_client {
        ProxyClientId::V2rayn => v2rayn::refresh(state).await,
        ProxyClientId::Happ => {
            let status = happ::refresh(&snapshot.settings, true, true, false)
                .await
                .map_err(|error| error.to_string())?;
            let merged = merge_with_previous(status, &snapshot.status);
            state.update_status(merged.clone());
            Ok(merged)
        }
    }
}

#[tauri::command]
pub async fn refresh_selected_client_background(
    state: State<'_, AppState>,
) -> Result<DashboardStatus, String> {
    let snapshot = state.snapshot();
    match snapshot.settings.selected_client {
        ProxyClientId::V2rayn => v2rayn::refresh_background(state).await,
        ProxyClientId::Happ => {
            let status = happ::refresh(&snapshot.settings, true, false, false)
                .await
                .map_err(|error| error.to_string())?;
            let merged = merge_with_previous(status, &snapshot.status);
            state.update_status(merged.clone());
            Ok(merged)
        }
    }
}

#[tauri::command]
pub async fn refresh_selected_client_startup(
    state: State<'_, AppState>,
) -> Result<DashboardStatus, String> {
    let snapshot = state.snapshot();
    match snapshot.settings.selected_client {
        ProxyClientId::V2rayn => v2rayn::refresh_startup(state).await,
        ProxyClientId::Happ => {
            let status = happ::refresh(&snapshot.settings, true, true, true)
                .await
                .map_err(|error| error.to_string())?;
            let merged = merge_with_previous(status, &snapshot.status);
            state.update_status(merged.clone());
            Ok(merged)
        }
    }
}

#[tauri::command]
pub async fn refresh_selected_client_post_route(
    state: State<'_, AppState>,
) -> Result<DashboardStatus, String> {
    let snapshot = state.snapshot();
    match snapshot.settings.selected_client {
        ProxyClientId::V2rayn => v2rayn::refresh_post_route(state).await,
        ProxyClientId::Happ => {
            let status = happ::refresh(&snapshot.settings, false, true, false)
                .await
                .map_err(|error| error.to_string())?;
            let merged = merge_with_previous(status, &snapshot.status);
            state.update_status(merged.clone());
            Ok(merged)
        }
    }
}

#[tauri::command]
pub async fn toggle_selected_client(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    match state.snapshot().settings.selected_client {
        ProxyClientId::V2rayn => v2rayn::toggle(state).await,
        ProxyClientId::Happ => Err(happ::unsupported_control_error("toggle_connection")),
    }
}

#[tauri::command]
pub async fn list_selected_client_items(
    state: State<'_, AppState>,
) -> Result<Vec<ProfileSummary>, String> {
    match state.snapshot().settings.selected_client {
        ProxyClientId::V2rayn => v2rayn::list_items(state).await,
        ProxyClientId::Happ => Ok(happ::list_items()),
    }
}

#[tauri::command]
pub async fn select_client_item(
    item_id: String,
    state: State<'_, AppState>,
) -> Result<DashboardStatus, String> {
    match state.snapshot().settings.selected_client {
        ProxyClientId::V2rayn => v2rayn::select_item(item_id, state).await,
        ProxyClientId::Happ => Err(happ::unsupported_control_error("select_item")),
    }
}

#[tauri::command]
pub async fn open_selected_client(state: State<'_, AppState>) -> Result<(), String> {
    let snapshot = state.snapshot();
    match snapshot.settings.selected_client {
        ProxyClientId::V2rayn => v2rayn::open(state).await,
        ProxyClientId::Happ => happ::open(&snapshot.settings),
    }
}

fn merge_with_previous(mut next: DashboardStatus, previous: &DashboardStatus) -> DashboardStatus {
    if next.external_ip.is_none() {
        next.external_ip = previous.external_ip.clone();
    }

    if next.latency_ms.is_none() {
        next.latency_ms = previous.latency_ms;
    }

    next
}
