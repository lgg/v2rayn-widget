use tauri::{AppHandle, Emitter, State};

use crate::{
    adapters::{self, happ, ProxyClientAdapter, RefreshKind},
    models::{
        client::{ClientDescriptor, ClientDiagnostics, ProxyClientId},
        path_validation::PathValidation,
        profile::ProfileSummary,
        settings::AppSettings,
        status::DashboardStatus,
    },
    state::app_state::AppState,
    utils::settings_store,
};

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
pub async fn get_happ_diagnostics(
    state: State<'_, AppState>,
) -> Result<ClientDiagnostics, String> {
    adapters::adapter(ProxyClientId::Happ).diagnostics(state).await
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
    app.emit(
        "client-selected",
        adapters::descriptor(client_id, &snapshot.settings),
    )
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

async fn refresh_with_kind(
    state: State<'_, AppState>,
    kind: RefreshKind,
) -> Result<DashboardStatus, String> {
    let client_id = state.snapshot().settings.selected_client;
    adapters::adapter(client_id).refresh(state, kind).await
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
    let client_id = state.snapshot().settings.selected_client;
    adapters::adapter(client_id).toggle(state).await
}

#[tauri::command]
pub async fn list_selected_client_items(
    state: State<'_, AppState>,
) -> Result<Vec<ProfileSummary>, String> {
    let client_id = state.snapshot().settings.selected_client;
    adapters::adapter(client_id).list_items(state).await
}

#[tauri::command]
pub async fn select_client_item(
    item_id: String,
    state: State<'_, AppState>,
) -> Result<DashboardStatus, String> {
    let client_id = state.snapshot().settings.selected_client;
    adapters::adapter(client_id)
        .select_item(item_id, state)
        .await
}

#[tauri::command]
pub async fn open_selected_client(state: State<'_, AppState>) -> Result<(), String> {
    let client_id = state.snapshot().settings.selected_client;
    adapters::adapter(client_id).open(state).await
}
