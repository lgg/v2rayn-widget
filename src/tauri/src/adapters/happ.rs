use std::{
    path::{Path, PathBuf},
    process::Command,
};

use chrono::Utc;
use sysinfo::{ProcessesToUpdate, System};

use crate::{
    models::{
        client::{
            CapabilityState, ClientCapabilities, ClientDescriptor, ClientDiagnostics,
            ProxyClientId, TransportMode,
        },
        profile::ProfileSummary,
        settings::{AppSettings, LatencyMode},
        status::{ConnectionState, DashboardStatus},
    },
    services::{
        happ_ui,
        health_check::{self, HealthCheckOptions},
    },
};

const HAPP_PROCESS_NAMES: &[&str] = &["happ.exe", "happ", "happ-desktop.exe", "happ-desktop"];
const HAPP_EXECUTABLE_NAMES: &[&str] = &[
    "Happ.exe",
    "happ.exe",
    "Happ Desktop.exe",
    "happ-desktop.exe",
];

pub fn descriptor(settings: &AppSettings) -> ClientDescriptor {
    let control_enabled = settings.happ_allow_ui_automation;
    ClientDescriptor {
        id: ProxyClientId::Happ,
        display_name: "Happ".to_owned(),
        maturity: if control_enabled {
            "experimental_ui_automation".to_owned()
        } else {
            "read_only_with_optional_experimental_control".to_owned()
        },
        status_note: if control_enabled {
            "Happ connection status and toggle use conservative Windows UI Automation. Server selection and subscriptions remain unavailable.".to_owned()
        } else {
            "Process detection and application launch are available. Open Happ setup to explicitly enable experimental Windows UI Automation control.".to_owned()
        },
        capabilities: ClientCapabilities {
            detect_application: CapabilityState::Supported,
            read_process_state: CapabilityState::Supported,
            read_connection_state: if control_enabled {
                CapabilityState::Experimental
            } else {
                CapabilityState::ResearchRequired
            },
            open_application: CapabilityState::Supported,
            toggle_connection: if control_enabled {
                CapabilityState::Experimental
            } else {
                CapabilityState::ResearchRequired
            },
            list_items: CapabilityState::ResearchRequired,
            select_item: CapabilityState::ResearchRequired,
            restart_application: CapabilityState::ResearchRequired,
            read_transport_mode: if control_enabled {
                CapabilityState::Experimental
            } else {
                CapabilityState::ResearchRequired
            },
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
    pub pid: Option<u32>,
    pub executable: Option<PathBuf>,
}

pub fn read_process_snapshot() -> HappProcessSnapshot {
    let mut system = System::new_all();
    system.refresh_processes(ProcessesToUpdate::All, true);

    system
        .processes()
        .iter()
        .filter_map(|(pid, process)| {
            let process_name = process.name().to_string_lossy().to_lowercase();
            if !is_happ_process_name(&process_name) {
                return None;
            }

            let executable = process.exe().map(Path::to_path_buf);
            let rank = process_candidate_rank(
                &process_name,
                executable
                    .as_deref()
                    .map(is_valid_happ_executable)
                    .unwrap_or(false),
                pid.as_u32(),
            );
            Some((rank, pid.as_u32(), executable))
        })
        .max_by_key(|(rank, pid, _)| (*rank, *pid))
        .map(|(_, pid, executable)| HappProcessSnapshot {
            running: true,
            pid: Some(pid),
            executable,
        })
        .unwrap_or_default()
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

    let ui = if process.running && settings.happ_allow_ui_automation {
        Some(happ_ui::probe(process.pid))
    } else {
        None
    };

    let connection_state = if !process.running {
        ConnectionState::Disconnected
    } else {
        ui.as_ref()
            .map(|snapshot| snapshot.connection_state)
            .unwrap_or(ConnectionState::Unknown)
    };
    let transport_mode = ui
        .as_ref()
        .map(|snapshot| snapshot.transport_mode)
        .unwrap_or(TransportMode::Unknown);

    let last_event = if !process.running {
        Some("Happ process is not running".to_owned())
    } else if let Some(snapshot) = &ui {
        Some(format!("{}; transport={:?}", snapshot.note, transport_mode))
    } else {
        Some(
            "Happ process detected; experimental UI Automation is disabled in Happ setup"
                .to_owned(),
        )
    };

    Ok(DashboardStatus {
        status: connection_state,
        tun_enabled: connection_state == ConnectionState::Connected
            && matches!(transport_mode, TransportMode::Tun | TransportMode::Mixed),
        connection_state,
        active_profile_name: None,
        external_ip: health.external_ip,
        latency_ms: health.latency_ms,
        last_error: None,
        last_event,
        updated_at: Utc::now(),
    })
}

pub async fn toggle(settings: &AppSettings) -> Result<DashboardStatus, String> {
    if !settings.happ_allow_ui_automation {
        return Err(
            "HAPP_UI_AUTOMATION_DISABLED: Open Happ setup and explicitly enable experimental Windows UI Automation control."
                .to_owned(),
        );
    }

    let mut process = read_process_snapshot();
    if !process.running {
        open(settings)?;
        for _ in 0..20 {
            tokio::time::sleep(std::time::Duration::from_millis(250)).await;
            process = read_process_snapshot();
            if process.running {
                break;
            }
        }
    }

    if !process.running {
        return Err("HAPP_START_TIMEOUT: Happ was launched but its process was not detected".to_owned());
    }

    let outcome = happ_ui::toggle_connection(process.pid).map_err(|error| error.to_string())?;
    for _ in 0..20 {
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        let observed = happ_ui::probe(process.pid);
        if observed.connection_state == outcome.expected_state {
            let mut status = refresh(settings, true, true, false)
                .await
                .map_err(|error| error.to_string())?;
            status.last_event = Some(format!(
                "{}; confirmed state={:?}",
                outcome.note, outcome.expected_state
            ));
            return Ok(status);
        }
    }

    Err(format!(
        "HAPP_TOGGLE_UNCONFIRMED: {}. The click was sent, but Happ did not expose the expected {:?} state within 5 seconds.",
        outcome.note, outcome.expected_state
    ))
}

pub fn diagnostics(settings: &AppSettings) -> ClientDiagnostics {
    let process = read_process_snapshot();
    let ui = happ_ui::probe(process.pid);

    ClientDiagnostics {
        client_id: ProxyClientId::Happ,
        application_running: process.running,
        process_id: process.pid,
        executable_path: detect_executable(settings).map(|path| path.to_string_lossy().to_string()),
        window_found: ui.window_found,
        window_title: ui.window_title,
        connection_state: if process.running {
            ui.connection_state
        } else {
            ConnectionState::Disconnected
        },
        transport_mode: ui.transport_mode,
        control_source: ui
            .action_label
            .as_ref()
            .map(|_| "windows_ui_automation".to_owned()),
        action_label: ui.action_label,
        action_score: ui.action_score,
        ui_nodes: ui.ui_nodes,
        note: ui.note,
    }
}

pub fn open(settings: &AppSettings) -> Result<(), String> {
    let executable = detect_executable(settings).ok_or_else(|| {
        "Happ executable not found. Start Happ once or configure its executable path in Happ setup."
            .to_owned()
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
        "Happ action '{action}' is unavailable. Server/profile and subscription operations require a documented stable control path."
    )
}

fn process_candidate_rank(name: &str, executable_is_valid: bool, pid: u32) -> u64 {
    let executable_score = if executable_is_valid { 1_000_000_u64 } else { 0 };
    let name_score = if matches!(name, "happ.exe" | "happ") {
        100_000_u64
    } else {
        0
    };
    executable_score + name_score + u64::from(pid)
}

fn is_happ_process_name(name: &str) -> bool {
    HAPP_PROCESS_NAMES.contains(&name)
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
    fn process_selection_prefers_valid_gui_executable_deterministically() {
        assert!(
            process_candidate_rank("happ.exe", true, 10)
                > process_candidate_rank("happ-desktop.exe", false, 9999)
        );
        assert!(
            process_candidate_rank("happ.exe", true, 20)
                > process_candidate_rank("happ.exe", true, 10)
        );
    }

    #[test]
    fn invalid_happ_path_is_rejected() {
        assert!(validate_executable_candidate("definitely-not-a-real-happ-path").is_none());
    }

    #[test]
    fn happ_control_is_opt_in() {
        let disabled = descriptor(&AppSettings::default()).capabilities;
        assert_eq!(
            disabled.toggle_connection,
            CapabilityState::ResearchRequired
        );

        let enabled_settings = AppSettings {
            happ_allow_ui_automation: true,
            ..AppSettings::default()
        };
        let enabled = descriptor(&enabled_settings).capabilities;
        assert_eq!(enabled.toggle_connection, CapabilityState::Experimental);
        assert_eq!(enabled.read_connection_state, CapabilityState::Experimental);
    }
}
