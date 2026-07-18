use tauri::State;

use crate::{
    commands,
    models::{
        client::{CapabilityState, ClientCapabilities, ClientDescriptor, ProxyClientId},
        profile::ProfileSummary,
        status::DashboardStatus,
    },
    state::app_state::AppState,
};

pub fn descriptor() -> ClientDescriptor {
    ClientDescriptor {
        id: ProxyClientId::V2rayn,
        display_name: "v2rayN".to_owned(),
        maturity: "stable_with_experimental_profile_switching".to_owned(),
        status_note: "Current v2rayN TUN integration is preserved behind an adapter boundary. Generic transport-mode reporting and all subscription operations are not supported.".to_owned(),
        capabilities: ClientCapabilities {
            detect_application: CapabilityState::Supported,
            read_process_state: CapabilityState::Supported,
            read_connection_state: CapabilityState::Supported,
            open_application: CapabilityState::Supported,
            toggle_connection: CapabilityState::Supported,
            list_items: CapabilityState::Supported,
            select_item: CapabilityState::Experimental,
            restart_application: CapabilityState::Supported,
            read_transport_mode: CapabilityState::Unsupported,
            list_subscriptions: CapabilityState::Unsupported,
            switch_subscription: CapabilityState::Unsupported,
            refresh_subscription: CapabilityState::Unsupported,
            manage_subscriptions: CapabilityState::Unsupported,
        },
    }
}

pub async fn refresh(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    commands::refresh_status(state).await
}

pub async fn refresh_background(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    commands::refresh_status_background(state).await
}

pub async fn refresh_startup(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    commands::refresh_status_startup(state).await
}

pub async fn refresh_post_route(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    commands::refresh_status_post_route(state).await
}

pub async fn toggle(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    commands::toggle_tun_via_ui(state).await
}

pub async fn list_items(state: State<'_, AppState>) -> Result<Vec<ProfileSummary>, String> {
    commands::list_profiles(state).await
}

pub async fn select_item(
    item_id: String,
    state: State<'_, AppState>,
) -> Result<DashboardStatus, String> {
    commands::set_active_profile(item_id, state).await
}

pub async fn open(state: State<'_, AppState>) -> Result<(), String> {
    commands::open_v2rayn(state).await
}
