use chrono::Utc;

use crate::models::status::{ConnectionState, DashboardStatus};
use crate::services::{
    config_reader::ConfigSnapshot, health_check::HealthSnapshot, log_reader::LogSnapshot,
    process_monitor::ProcessSnapshot,
};

#[derive(Debug, Clone)]
pub struct StatusInputs {
    pub config: ConfigSnapshot,
    pub logs: Option<LogSnapshot>,
    pub health: HealthSnapshot,
    pub process: ProcessSnapshot,
    pub require_connectivity_check: bool,
    pub require_external_ip_check: bool,
}

pub fn resolve_status(inputs: StatusInputs) -> DashboardStatus {
    let configured_tun = inputs.config.enable_tun;
    let tun_enabled = configured_tun.unwrap_or(false);
    let last_error = inputs
        .logs
        .as_ref()
        .and_then(|logs| logs.last_error.clone());
    let last_event = inputs
        .logs
        .as_ref()
        .and_then(|logs| logs.last_event.clone());

    let latency_ms = inputs
        .health
        .latency_ms
        .or_else(|| inputs.logs.as_ref().and_then(|logs| logs.latency_ms));

    let startup_error = inputs
        .logs
        .as_ref()
        .map(|logs| logs.startup_error)
        .unwrap_or(false);

    let connectivity_ok = if inputs.require_connectivity_check {
        inputs.health.connectivity_checked && inputs.health.health_ok
    } else {
        true
    };

    let external_ip_ok = if inputs.require_external_ip_check {
        inputs.health.external_ip.is_some()
    } else {
        true
    };

    let explicit_health_error = inputs.require_connectivity_check
        && inputs.health.connectivity_checked
        && !inputs.health.health_ok;

    let connection_state = if !inputs.process.v2rayn_running || configured_tun == Some(false) {
        ConnectionState::Disconnected
    } else if startup_error || last_error.is_some() || explicit_health_error {
        ConnectionState::Error
    } else if configured_tun.is_none() {
        // A running process without a readable boolean EnableTun value is not proof
        // of either an active or inactive tunnel. Fail closed instead of presenting a
        // misleading Disconnected state for an unknown/new v2rayN schema.
        ConnectionState::Unknown
    } else if connectivity_ok && external_ip_ok {
        ConnectionState::Connected
    } else {
        ConnectionState::Connecting
    };

    DashboardStatus {
        status: connection_state,
        tun_enabled,
        connection_state,
        active_profile_name: inputs.config.active_profile_name,
        external_ip: inputs.health.external_ip,
        latency_ms,
        last_error,
        last_event,
        updated_at: Utc::now(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_inputs() -> StatusInputs {
        StatusInputs {
            config: ConfigSnapshot {
                enable_tun: Some(true),
                active_profile_name: Some("demo".to_owned()),
                profiles: vec![],
            },
            logs: Some(LogSnapshot::default()),
            health: HealthSnapshot {
                health_ok: true,
                connectivity_checked: true,
                external_ip_checked: true,
                external_ip: Some([1, 1, 1, 1].map(|part| part.to_string()).join(".")),
                latency_ms: Some(20),
            },
            process: ProcessSnapshot {
                v2rayn_running: true,
                v2rayn_pid: Some(42),
                v2rayn_pids: vec![42],
                core_processes: vec![],
            },
            require_connectivity_check: true,
            require_external_ip_check: true,
        }
    }

    #[test]
    fn connected_when_tun_process_health_and_ip_are_ok() {
        let resolved = resolve_status(base_inputs());
        assert_eq!(resolved.connection_state, ConnectionState::Connected);
        assert_eq!(resolved.status, ConnectionState::Connected);
    }

    #[test]
    fn disconnected_when_tun_disabled() {
        let mut inputs = base_inputs();
        inputs.config.enable_tun = Some(false);

        let resolved = resolve_status(inputs);
        assert_eq!(resolved.connection_state, ConnectionState::Disconnected);
    }

    #[test]
    fn error_when_has_log_error() {
        let mut inputs = base_inputs();
        inputs.health.health_ok = false;
        inputs.health.external_ip = None;
        inputs.logs = Some(LogSnapshot {
            last_error: Some("tun init failed".to_owned()),
            startup_error: true,
            ..LogSnapshot::default()
        });

        let resolved = resolve_status(inputs);
        assert_eq!(resolved.connection_state, ConnectionState::Error);
    }

    #[test]
    fn connecting_when_tun_on_process_running_without_health_signal() {
        let mut inputs = base_inputs();
        inputs.health.health_ok = false;
        inputs.health.connectivity_checked = false;
        inputs.health.external_ip = None;
        inputs.logs = None;

        let resolved = resolve_status(inputs);
        assert_eq!(resolved.connection_state, ConnectionState::Connecting);
        assert_eq!(resolved.status, ConnectionState::Connecting);
    }

    #[test]
    fn connected_when_checks_are_disabled() {
        let mut inputs = base_inputs();
        inputs.require_connectivity_check = false;
        inputs.require_external_ip_check = false;
        inputs.health.connectivity_checked = false;
        inputs.health.external_ip = None;
        inputs.health.health_ok = false;

        let resolved = resolve_status(inputs);
        assert_eq!(resolved.connection_state, ConnectionState::Connected);
    }

    #[test]
    fn unknown_when_running_config_does_not_expose_boolean_tun_state() {
        let mut inputs = base_inputs();
        inputs.config.enable_tun = None;

        let resolved = resolve_status(inputs);

        assert_eq!(resolved.connection_state, ConnectionState::Unknown);
        assert_eq!(resolved.status, ConnectionState::Unknown);
        assert!(!resolved.tun_enabled);
    }

    #[test]
    fn absent_process_is_disconnected_even_when_tun_schema_is_unknown() {
        let mut inputs = base_inputs();
        inputs.config.enable_tun = None;
        inputs.process.v2rayn_running = false;
        inputs.process.v2rayn_pid = None;
        inputs.process.v2rayn_pids.clear();

        let resolved = resolve_status(inputs);

        assert_eq!(resolved.connection_state, ConnectionState::Disconnected);
    }
}
