use std::{
    path::{Path, PathBuf},
    process::Command,
};

use chrono::Utc;
use sysinfo::{ProcessesToUpdate, System};

use crate::{
    models::{
        client::{CapabilityState, ClientCapabilities, ClientDescriptor, ProxyClientId},
        profile::ProfileSummary,
        settings::{AppSettings, LatencyMode},
        status::{ConnectionState, DashboardStatus},
    },
    services::health_check::{self, HealthCheckOptions},
};

const HAPP_PROCESS_NAMES: &[&str] = &["happ.exe", "happ", "happ-desktop.exe", "happ-desktop"];
const HAPP_EXECUTABLE_NAMES: &[&str] = &[
    "Happ.exe",
    "happ.exe",
    "Happ Desktop.exe",
    "happ-desktop.exe",
];

pub fn descriptor() -> ClientDescriptor {
    ClientDescriptor {
        id: ProxyClientId::Happ,
        display_name: "Happ".to_owned(),
        maturity: "read_only_mvp".to_owned(),
        status_note: "Process detection and application launch are available. Reliable connection control, server selection, transport mode and subscriptions require API/IPC research.".to_owned(),
        capabilities: ClientCapabilities {
            detect_application: CapabilityState::Supported,
            read_process_state: CapabilityState::Supported,
            read_connection_state: CapabilityState::ResearchRequired,
            open_application: CapabilityState::Supported,
            toggle_connection: CapabilityState::ResearchRequired,
            list_items: CapabilityState::ResearchRequired,
            select_item: CapabilityState::ResearchRequired,
            restart_application: CapabilityState::ResearchRequired,
            read_transport_mode: CapabilityState::ResearchRequired,
            list_subscriptions: CapabilityState::ResearchRequired,
            switch_subscription: CapabilityState::ResearchRequired,
            refresh_subscription: CapabilityState::ResearchRequired,
            manage_subscriptions: CapabilityState::ResearchRequired,
        },
    }
}

#[derive(Debug, Clone, Default)]
pub struct HappProcessSnapshot {
    pub running: bool,
    pub executable: Option<PathBuf>,
}

pub fn read_process_snapshot() -> HappProcessSnapshot {
    let mut system = System::new_all();
    system.refresh_processes(ProcessesToUpdate::All, true);

    for process in system.processes().values() {
        let process_name = process.name().to_string_lossy().to_lowercase();
        if !is_happ_process_name(&process_name) {
            continue;
        }

        return HappProcessSnapshot {
            running: true,
            executable: process.exe().map(Path::to_path_buf),
        };
    }

    HappProcessSnapshot::default()
}

pub fn detect_executable(settings: &AppSettings) -> Option<PathBuf> {
    settings
        .happ_path
        .as_deref()
        .and_then(validate_executable_candidate)
        .or_else(|| {
            read_process_snapshot()
                .executable
                .filter(|path| is_valid_happ_executable(path))
        })
        .or_else(detect_common_install_path)
}

pub fn validate_executable_candidate(value: &str) -> Option<PathBuf> {
    normalize_candidate(value)
}

pub async fn refresh(
    settings: &AppSettings,
    include_latency_probe: bool,
    include_external_ip_probe: bool,
    force_full_probe: bool,
) -> anyhow::Result<DashboardStatus> {
    let process = read_process_snapshot();
    let effective_latency_mode = if force_full_probe {
        LatencyMode::Active
    } else {
        settings.latency_mode.clone()
    };

    let check_latency = include_latency_probe && (settings.show_latency || force_full_probe);
    let check_external_ip =
        include_external_ip_probe && (settings.show_external_ip || force_full_probe);

    let health_options = HealthCheckOptions {
        enable_external_ip: check_external_ip,
        enable_connectivity_latency: check_latency,
        latency_mode: effective_latency_mode,
        connectivity_endpoints: settings.connectivity_endpoints.clone(),
        ip_endpoints: settings.ip_endpoints.clone(),
    };

    let health = if health_options.enable_external_ip
        || (health_options.enable_connectivity_latency
            && matches!(health_options.latency_mode, LatencyMode::Active))
    {
        let client = health_check::build_http_client()?;
        health_check::check(&client, &health_options).await
    } else {
        health_check::HealthSnapshot::default()
    };

    let connection_state = if process.running {
        ConnectionState::Unknown
    } else {
        ConnectionState::Disconnected
    };

    let last_event = if process.running {
        Some(
            "Happ process detected; reliable connection-state source is not implemented yet"
                .to_owned(),
        )
    } else {
        Some("Happ process is not running".to_owned())
    };

    Ok(DashboardStatus {
        status: connection_state,
        tun_enabled: false,
        connection_state,
        active_profile_name: None,
        external_ip: health.external_ip,
        latency_ms: health.latency_ms,
        last_error: None,
        last_event,
        updated_at: Utc::now(),
    })
}

pub fn open(settings: &AppSettings) -> Result<(), String> {
    let executable = detect_executable(settings).ok_or_else(|| {
        "Happ executable not found. Start Happ once or configure happ_path.".to_owned()
    })?;

    Command::new(&executable)
        .spawn()
        .map_err(|error| format!("Could not open Happ at {}: {error}", executable.display()))?;

    Ok(())
}

pub fn list_items() -> Vec<ProfileSummary> {
    Vec::new()
}

pub fn unsupported_control_error(action: &str) -> String {
    format!(
        "Happ action '{action}' is not available in the read-only adapter. API/IPC research is required."
    )
}

fn is_happ_process_name(name: &str) -> bool {
    HAPP_PROCESS_NAMES
        .iter()
        .any(|candidate| name == *candidate)
}

fn normalize_candidate(value: &str) -> Option<PathBuf> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    let path = PathBuf::from(trimmed);
    if path.is_file() && is_valid_happ_executable(&path) {
        return Some(path);
    }

    if path.is_dir() {
        for name in HAPP_EXECUTABLE_NAMES {
            let candidate = path.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    None
}

fn detect_common_install_path() -> Option<PathBuf> {
    let mut roots = Vec::new();

    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        let root = PathBuf::from(local_app_data);
        roots.push(root.join("Programs").join("Happ"));
        roots.push(root.join("Happ"));
    }

    if let Some(program_files) = std::env::var_os("PROGRAMFILES") {
        roots.push(PathBuf::from(program_files).join("Happ"));
    }

    if let Some(program_files_x86) = std::env::var_os("PROGRAMFILES(X86)") {
        roots.push(PathBuf::from(program_files_x86).join("Happ"));
    }

    roots
        .iter()
        .find_map(|root| normalize_candidate(&root.to_string_lossy()))
}

fn is_valid_happ_executable(path: &Path) -> bool {
    let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
        return false;
    };

    HAPP_EXECUTABLE_NAMES
        .iter()
        .any(|candidate| file_name.eq_ignore_ascii_case(candidate))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_supported_process_names() {
        assert!(is_happ_process_name("happ.exe"));
        assert!(is_happ_process_name("happ-desktop.exe"));
        assert!(!is_happ_process_name("unrelated.exe"));
    }

    #[test]
    fn invalid_happ_path_is_rejected() {
        assert!(validate_executable_candidate("definitely-not-a-real-happ-path").is_none());
    }

    #[test]
    fn happ_does_not_claim_connection_control() {
        let capabilities = descriptor().capabilities;
        assert_eq!(
            capabilities.toggle_connection,
            CapabilityState::ResearchRequired
        );
        assert_eq!(
            capabilities.read_connection_state,
            CapabilityState::ResearchRequired
        );
    }
}
