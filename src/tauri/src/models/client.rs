use serde::{Deserialize, Serialize};

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
        assert_eq!(
            serde_json::to_string(&ProxyClientId::Happ).unwrap(),
            "\"happ\""
        );
    }
}
