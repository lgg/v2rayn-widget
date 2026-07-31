use serde::Serialize;

use crate::models::{client::ProxyClientId, status::DashboardStatus};

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TrayOperation {
    Refresh,
    OpenClient,
}

#[derive(Debug, Clone, Serialize)]
pub struct TrayOperationError {
    pub client_id: ProxyClientId,
    pub operation: TrayOperation,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TrayStatusUpdate {
    pub client_id: ProxyClientId,
    pub status: DashboardStatus,
}
