use serde::{Deserialize, Serialize};

use crate::models::client::ProxyClientId;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ThemeMode {
    Light,
    Dark,
}

impl Default for ThemeMode {
    fn default() -> Self {
        Self::Dark
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum V2RayNPathMode {
    Auto,
    Manual,
}

impl Default for V2RayNPathMode {
    fn default() -> Self {
        Self::Auto
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TimeFormat {
    #[serde(rename = "system")]
    System,
    #[serde(rename = "24h")]
    H24,
    #[serde(rename = "12h")]
    H12,
}

impl Default for TimeFormat {
    fn default() -> Self {
        Self::System
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LatencyMode {
    Active,
    LogSnapshot,
}

impl Default for LatencyMode {
    fn default() -> Self {
        Self::Active
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WindowPosition {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

pub fn default_connectivity_endpoints() -> Vec<String> {
    vec![
        "https://www.msftconnecttest.com/connecttest.txt".to_owned(),
        "https://www.gstatic.com/generate_204".to_owned(),
        "https://www.cloudflare.com/cdn-cgi/trace".to_owned(),
    ]
}

pub fn default_ip_endpoints() -> Vec<String> {
    vec![
        "https://api.ipify.org?format=json".to_owned(),
        "https://ifconfig.me/ip".to_owned(),
        "https://icanhazip.com".to_owned(),
    ]
}

pub fn default_diagnostics_url() -> String {
    "https://ipleak.net/".to_owned()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppSettings {
    pub selected_client: ProxyClientId,
    pub language: String,
    pub theme: ThemeMode,
    pub always_on_top: bool,
    pub autostart_with_windows: bool,
    pub allow_restart_fallback: bool,
    pub poll_interval_sec: u64,
    pub time_format: TimeFormat,
    pub show_clock: bool,
    pub show_info_status: bool,
    pub show_external_ip: bool,
    pub show_latency: bool,
    pub mock_mode_enabled: bool,
    pub show_action_buttons: bool,
    pub show_profile_selector: bool,
    pub window_effect_enabled: bool,
    pub window_opacity_percent: u8,
    pub diagnostics_enabled: bool,
    #[serde(default = "default_diagnostics_url")]
    pub diagnostics_url: String,
    pub latency_mode: LatencyMode,
    #[serde(default = "default_connectivity_endpoints")]
    pub connectivity_endpoints: Vec<String>,
    #[serde(default = "default_ip_endpoints")]
    pub ip_endpoints: Vec<String>,
    pub v2rayn_path_mode: V2RayNPathMode,
    pub v2rayn_path: Option<String>,
    pub happ_path: Option<String>,
    pub window_position: Option<WindowPosition>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            selected_client: ProxyClientId::V2rayn,
            language: "en".to_owned(),
            theme: ThemeMode::Dark,
            always_on_top: false,
            autostart_with_windows: false,
            allow_restart_fallback: false,
            poll_interval_sec: 10,
            time_format: TimeFormat::System,
            show_clock: true,
            show_info_status: true,
            show_external_ip: true,
            show_latency: true,
            mock_mode_enabled: false,
            show_action_buttons: true,
            show_profile_selector: true,
            window_effect_enabled: true,
            window_opacity_percent: 92,
            diagnostics_enabled: false,
            diagnostics_url: default_diagnostics_url(),
            latency_mode: LatencyMode::Active,
            connectivity_endpoints: default_connectivity_endpoints(),
            ip_endpoints: default_ip_endpoints(),
            v2rayn_path_mode: V2RayNPathMode::Auto,
            v2rayn_path: None,
            happ_path: None,
            window_position: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct UiSettingsPatch {
    pub language: Option<String>,
    pub theme: Option<ThemeMode>,
    pub always_on_top: Option<bool>,
    pub time_format: Option<TimeFormat>,
    pub show_clock: Option<bool>,
    pub show_info_status: Option<bool>,
    pub show_external_ip: Option<bool>,
    pub show_latency: Option<bool>,
    pub mock_mode_enabled: Option<bool>,
    pub show_action_buttons: Option<bool>,
    pub show_profile_selector: Option<bool>,
    pub window_effect_enabled: Option<bool>,
    pub window_opacity_percent: Option<u8>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_settings_default_to_v2rayn() {
        let json = r#"{"language":"en"}"#;
        let settings: AppSettings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.selected_client, ProxyClientId::V2rayn);
        assert!(settings.happ_path.is_none());
    }
}
