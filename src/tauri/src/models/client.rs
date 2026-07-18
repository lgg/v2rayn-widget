use serde::{Deserialize, Serialize};

use crate::models::status::ConnectionState;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum ProxyClientId {
    V2rayn,
    Happ,
}

impl Default for ProxyClientId {
    fn default() -> Self {
        Self::V2rayn
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CapabilityState {
    Supported,
    Experimental,
    Unsupported,
    ResearchRequired,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum TransportMode {
    #[default]
    Unknown,
    Proxy,
    Tun,
    Mixed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ClientCapabilities {
    pub detect_application: CapabilityState,
    pub read_process_state: CapabilityState,
    pub read_connection_state: CapabilityState,
    pub open_application: CapabilityState,
    pub toggle_connection: CapabilityState,
    pub list_items: CapabilityState,
    pub select_item: CapabilityState,
    pub restart_application: CapabilityState,
    pub read_transport_mode: CapabilityState,
    pub list_subscriptions: CapabilityState,
    pub switch_subscription: CapabilityState,
    pub refresh_subscription: CapabilityState,
    pub manage_subscriptions: CapabilityState,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ClientDescriptor {
    pub id: ProxyClientId,
    pub display_name: String,
    pub maturity: String,
    pub status_note: String,
    pub capabilities: ClientCapabilities,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ClientDiagnostics {
    pub client_id: ProxyClientId,
    pub application_running: bool,
    pub process_id: Option<u32>,
    pub executable_path: Option<String>,
    pub window_found: bool,
    pub window_title: Option<String>,
    pub connection_state: ConnectionState,
    pub transport_mode: TransportMode,
    pub control_source: Option<String>,
    pub action_label: Option<String>,
    pub action_score: Option<i32>,
    pub ui_nodes: Vec<String>,
    pub note: String,
}

impl ClientDiagnostics {
    pub fn unavailable(client_id: ProxyClientId, note: impl Into<String>) -> Self {
        Self {
            client_id,
            application_running: false,
            process_id: None,
            executable_path: None,
            window_found: false,
            window_title: None,
            connection_state: ConnectionState::Unknown,
            transport_mode: TransportMode::Unknown,
            control_source: None,
            action_label: None,
            action_score: None,
            ui_nodes: Vec::new(),
            note: note.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn selected_client_default_is_v2rayn() {
        assert_eq!(ProxyClientId::default(), ProxyClientId::V2rayn);
    }

    #[test]
    fn client_ids_serialize_stably() {
        assert_eq!(
            serde_json::to_string(&ProxyClientId::V2rayn).unwrap(),
            "\"v2rayn\""
        );
        assert_eq!(serde_json::to_string(&ProxyClientId::Happ).unwrap(), "\"happ\"");
    }

    #[test]
    fn transport_mode_defaults_to_unknown() {
        assert_eq!(TransportMode::default(), TransportMode::Unknown);
    }
}