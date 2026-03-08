use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PrivilegeDiagnostics {
    pub widget_is_admin: bool,
    pub v2rayn_pid: Option<u32>,
    pub v2rayn_is_admin: Option<bool>,
    pub uipi_mismatch: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UiAutomationNode {
    pub name: Option<String>,
    pub automation_id: Option<String>,
    pub class_name: Option<String>,
    pub control_type: String,
    pub bounds: Option<String>,
    pub native_hwnd: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DebugRuntimeSnapshot {
    pub enable_tun: Option<bool>,
    pub active_profile_name: Option<String>,
    pub v2rayn_running: bool,
    pub v2rayn_pid: Option<u32>,
    pub last_event: Option<String>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UiDebugReport {
    pub window_found: bool,
    pub window_title: Option<String>,
    pub window_pid: Option<u32>,
    pub window_process_name: Option<String>,
    pub tun_control_found: bool,
    pub tun_control_title: Option<String>,
    pub reload_control_found: bool,
    pub reload_control_title: Option<String>,
    pub child_controls: Vec<String>,
    pub tun_candidates: Vec<String>,
    pub reload_candidates: Vec<String>,
    pub uia_nodes: Vec<UiAutomationNode>,
    pub privilege: PrivilegeDiagnostics,
    pub note: String,
}
