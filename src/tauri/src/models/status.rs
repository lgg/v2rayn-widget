use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "PascalCase")]
pub enum ConnectionState {
    Connected,
    Disconnected,
    Error,
    #[default]
    Unknown,
    Connecting,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardStatus {
    pub status: ConnectionState,
    pub tun_enabled: bool,
    pub connection_state: ConnectionState,
    pub active_profile_name: Option<String>,
    pub external_ip: Option<String>,
    pub latency_ms: Option<u64>,
    pub last_error: Option<String>,
    pub last_event: Option<String>,
    pub updated_at: DateTime<Utc>,
}

impl Default for DashboardStatus {
    fn default() -> Self {
        Self {
            status: ConnectionState::Unknown,
            tun_enabled: false,
            connection_state: ConnectionState::Unknown,
            active_profile_name: None,
            external_ip: None,
            latency_ms: None,
            last_error: None,
            last_event: None,
            updated_at: Utc::now(),
        }
    }
}
