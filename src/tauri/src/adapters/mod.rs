pub mod happ;
pub mod v2rayn;

use tauri::State;

use crate::{
    models::{
        client::{
            ClientDescriptor, ClientDiagnostics, ProxyClientId, TransportMode,
        },
        profile::ProfileSummary,
        settings::AppSettings,
        status::DashboardStatus,
    },
    services::process_monitor,
    state::app_state::AppState,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RefreshKind {
    Foreground,
    Background,
    Startup,
    PostRoute,
}

pub trait ProxyClientAdapter: Send + Sync {
    fn id(&self) -> ProxyClientId;
    fn descriptor(&self, settings: &AppSettings) -> ClientDescriptor;

    async fn refresh(
        &self,
        state: State<'_, AppState>,
        kind: RefreshKind,
    ) -> Result<DashboardStatus, String>;

    async fn toggle(&self, state: State<'_, AppState>) -> Result<DashboardStatus, String>;

    async fn list_items(
        &self,
        state: State<'_, AppState>,
    ) -> Result<Vec<ProfileSummary>, String>;

    async fn select_item(
        &self,
        item_id: String,
        state: State<'_, AppState>,
    ) -> Result<DashboardStatus, String>;

    async fn open(&self, state: State<'_, AppState>) -> Result<(), String>;

    async fn diagnostics(
        &self,
        state: State<'_, AppState>,
    ) -> Result<ClientDiagnostics, String>;
}

#[derive(Debug, Clone, Copy)]
pub enum RegisteredAdapter {
    V2rayn,
    Happ,
}

impl ProxyClientAdapter for RegisteredAdapter {
    fn id(&self) -> ProxyClientId {
        match self {
            Self::V2rayn => ProxyClientId::V2rayn,
            Self::Happ => ProxyClientId::Happ,
        }
    }

    fn descriptor(&self, settings: &AppSettings) -> ClientDescriptor {
        match self {
            Self::V2rayn => v2rayn::descriptor(),
            Self::Happ => happ::descriptor(settings),
        }
    }

    async fn refresh(
        &self,
        state: State<'_, AppState>,
        kind: RefreshKind,
    ) -> Result<DashboardStatus, String> {
        match self {
            Self::V2rayn => match kind {
                RefreshKind::Foreground => v2rayn::refresh(state).await,
                RefreshKind::Background => v2rayn::refresh_background(state).await,
                RefreshKind::Startup => v2rayn::refresh_startup(state).await,
                RefreshKind::PostRoute => v2rayn::refresh_post_route(state).await,
            },
            Self::Happ => {
                let snapshot = state.snapshot();
                let (latency, external_ip, force_full) = match kind {
                    RefreshKind::Foreground => (true, true, false),
                    RefreshKind::Background => (true, false, false),
                    RefreshKind::Startup => (true, true, true),
                    RefreshKind::PostRoute => (false, true, false),
                };
                let status = happ::refresh(
                    &snapshot.settings,
                    latency,
                    external_ip,
                    force_full,
                )
                .await
                .map_err(|error| error.to_string())?;
                let merged = merge_with_previous(status, &snapshot.status);
                state.update_status(merged.clone());
                Ok(merged)
            }
        }
    }

    async fn toggle(&self, state: State<'_, AppState>) -> Result<DashboardStatus, String> {
        match self {
            Self::V2rayn => v2rayn::toggle(state).await,
            Self::Happ => {
                let settings = state.snapshot().settings;
                let status = happ::toggle(&settings).await?;
                state.update_status(status.clone());
                Ok(status)
            }
        }
    }

    async fn list_items(
        &self,
        state: State<'_, AppState>,
    ) -> Result<Vec<ProfileSummary>, String> {
        match self {
            Self::V2rayn => v2rayn::list_items(state).await,
            Self::Happ => Ok(happ::list_items()),
        }
    }

    async fn select_item(
        &self,
        item_id: String,
        state: State<'_, AppState>,
    ) -> Result<DashboardStatus, String> {
        match self {
            Self::V2rayn => v2rayn::select_item(item_id, state).await,
            Self::Happ => Err(happ::unsupported_control_error("select_item")),
        }
    }

    async fn open(&self, state: State<'_, AppState>) -> Result<(), String> {
        match self {
            Self::V2rayn => v2rayn::open(state).await,
            Self::Happ => happ::open(&state.snapshot().settings),
        }
    }

    async fn diagnostics(
        &self,
        state: State<'_, AppState>,
    ) -> Result<ClientDiagnostics, String> {
        match self {
            Self::Happ => Ok(happ::diagnostics(&state.snapshot().settings)),
            Self::V2rayn => {
                let snapshot = state.snapshot();
                let process = process_monitor::read_process_snapshot();
                Ok(ClientDiagnostics {
                    client_id: ProxyClientId::V2rayn,
                    application_running: process.v2rayn_running,
                    process_id: process.v2rayn_pid,
                    executable_path: snapshot.settings.v2rayn_path.clone(),
                    window_found: false,
                    window_title: None,
                    connection_state: snapshot.status.connection_state,
                    transport_mode: TransportMode::Tun,
                    control_source: Some("v2rayn_compatibility_adapter".to_owned()),
                    action_label: None,
                    action_score: None,
                    ui_nodes: Vec::new(),
                    note: "v2rayN diagnostics remain available in the dedicated Debug Tools window"
                        .to_owned(),
                })
            }
        }
    }
}

fn registered_adapters() -> [RegisteredAdapter; 2] {
    [RegisteredAdapter::V2rayn, RegisteredAdapter::Happ]
}

pub fn catalog(settings: &AppSettings) -> Vec<ClientDescriptor> {
    registered_adapters()
        .into_iter()
        .map(|adapter| adapter.descriptor(settings))
        .collect()
}

pub fn adapter(client_id: ProxyClientId) -> RegisteredAdapter {
    registered_adapters()
        .into_iter()
        .find(|adapter| adapter.id() == client_id)
        .expect("all ProxyClientId variants must have a registered adapter")
}

pub fn descriptor(client_id: ProxyClientId, settings: &AppSettings) -> ClientDescriptor {
    adapter(client_id).descriptor(settings)
}

fn merge_with_previous(
    mut next: DashboardStatus,
    previous: &DashboardStatus,
) -> DashboardStatus {
    if next.external_ip.is_none() {
        next.external_ip = previous.external_ip.clone();
    }

    if next.latency_ms.is_none() {
        next.latency_ms = previous.latency_ms;
    }

    next
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::client::CapabilityState;

    #[test]
    fn registry_contains_v2rayn_and_happ() {
        let entries = catalog(&AppSettings::default());
        assert_eq!(entries.len(), 2);
        assert!(entries
            .iter()
            .any(|entry| entry.id == ProxyClientId::V2rayn));
        assert!(entries.iter().any(|entry| entry.id == ProxyClientId::Happ));
    }

    #[test]
    fn every_client_id_resolves_through_adapter_trait() {
        assert_eq!(adapter(ProxyClientId::V2rayn).id(), ProxyClientId::V2rayn);
        assert_eq!(adapter(ProxyClientId::Happ).id(), ProxyClientId::Happ);
    }

    #[test]
    fn v2rayn_subscriptions_are_explicitly_unsupported() {
        let entry = descriptor(ProxyClientId::V2rayn, &AppSettings::default());
        assert_eq!(
            entry.capabilities.switch_subscription,
            CapabilityState::Unsupported
        );
        assert_eq!(
            entry.capabilities.manage_subscriptions,
            CapabilityState::Unsupported
        );
    }

    #[test]
    fn happ_toggle_capability_follows_explicit_opt_in() {
        let mut settings = AppSettings::default();
        let disabled = descriptor(ProxyClientId::Happ, &settings);
        assert_eq!(
            disabled.capabilities.toggle_connection,
            CapabilityState::ResearchRequired
        );

        settings.happ_allow_ui_automation = true;
        let enabled = descriptor(ProxyClientId::Happ, &settings);
        assert_eq!(
            enabled.capabilities.toggle_connection,
            CapabilityState::Experimental
        );
    }
}