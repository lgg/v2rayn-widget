use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex, MutexGuard,
};

use crate::models::{
    client::ProxyClientId,
    settings::{AppSettings, WindowPosition},
    status::DashboardStatus,
};

#[derive(Debug, Clone)]
pub struct Snapshot {
    pub settings: AppSettings,
    pub status: DashboardStatus,
    pub client_epoch: u64,
}

#[derive(Debug)]
struct AppStateInner {
    settings: AppSettings,
    status: DashboardStatus,
    client_epoch: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ActiveClientContextChange {
    None,
    SelectedClient,
    V2raynPath,
    V2raynMockMode,
    HappControl,
}

fn active_client_context_change(
    previous: &AppSettings,
    next: &AppSettings,
) -> ActiveClientContextChange {
    if previous.selected_client != next.selected_client {
        return ActiveClientContextChange::SelectedClient;
    }

    match next.selected_client {
        ProxyClientId::V2rayn => {
            if previous.mock_mode_enabled != next.mock_mode_enabled {
                ActiveClientContextChange::V2raynMockMode
            } else if previous.v2rayn_path_mode != next.v2rayn_path_mode
                || previous.v2rayn_path != next.v2rayn_path
            {
                ActiveClientContextChange::V2raynPath
            } else {
                ActiveClientContextChange::None
            }
        }
        ProxyClientId::Happ => {
            if previous.happ_path != next.happ_path
                || previous.happ_allow_ui_automation != next.happ_allow_ui_automation
            {
                ActiveClientContextChange::HappControl
            } else {
                ActiveClientContextChange::None
            }
        }
    }
}

#[derive(Debug)]
pub struct AppState {
    inner: Mutex<AppStateInner>,
    settings_update_lock: Mutex<()>,
    v2rayn_operation_lock: tokio::sync::Mutex<()>,
    happ_operation_lock: tokio::sync::Mutex<()>,
    window_position_revision: AtomicU64,
}

impl AppState {
    pub fn new(settings: AppSettings, status: DashboardStatus) -> Self {
        Self {
            inner: Mutex::new(AppStateInner {
                settings,
                status,
                client_epoch: 0,
            }),
            settings_update_lock: Mutex::new(()),
            v2rayn_operation_lock: tokio::sync::Mutex::new(()),
            happ_operation_lock: tokio::sync::Mutex::new(()),
            window_position_revision: AtomicU64::new(0),
        }
    }

    pub fn lock_settings_update(&self) -> MutexGuard<'_, ()> {
        self.settings_update_lock
            .lock()
            .expect("Settings update lock poisoned")
    }

    pub async fn lock_v2rayn_operation(&self) -> tokio::sync::MutexGuard<'_, ()> {
        self.v2rayn_operation_lock.lock().await
    }

    pub async fn lock_happ_operation(&self) -> tokio::sync::MutexGuard<'_, ()> {
        self.happ_operation_lock.lock().await
    }

    pub fn snapshot(&self) -> Snapshot {
        let guard = self.inner.lock().expect("AppState lock poisoned");
        Snapshot {
            settings: guard.settings.clone(),
            status: guard.status.clone(),
            client_epoch: guard.client_epoch,
        }
    }

    pub fn update_settings(&self, settings: AppSettings) {
        let mut guard = self.inner.lock().expect("AppState lock poisoned");
        if guard.settings.selected_client != settings.selected_client {
            guard.client_epoch = guard.client_epoch.wrapping_add(1);
        }
        guard.settings = settings;
    }

    pub fn update_window_position(&self, position: WindowPosition) -> Option<u64> {
        let mut guard = self.inner.lock().expect("AppState lock poisoned");
        if guard.settings.window_position.as_ref() == Some(&position) {
            return None;
        }
        guard.settings.window_position = Some(position);
        Some(self.window_position_revision.fetch_add(1, Ordering::SeqCst) + 1)
    }

    pub fn window_position_revision_is_current(&self, revision: u64) -> bool {
        self.window_position_revision.load(Ordering::SeqCst) == revision
    }

    pub fn replace_settings_and_status(
        &self,
        settings: AppSettings,
        status: DashboardStatus,
    ) -> u64 {
        let mut guard = self.inner.lock().expect("AppState lock poisoned");
        if guard.settings.selected_client != settings.selected_client {
            guard.client_epoch = guard.client_epoch.wrapping_add(1);
        }
        guard.settings = settings;
        guard.status = status;
        guard.client_epoch
    }

    pub fn replace_settings_and_status_invalidating_context(
        &self,
        settings: AppSettings,
        status: DashboardStatus,
    ) -> u64 {
        let mut guard = self.inner.lock().expect("AppState lock poisoned");
        let context_change = active_client_context_change(&guard.settings, &settings);

        if context_change == ActiveClientContextChange::None {
            // A caller may use this path for a general settings save, but changing
            // appearance, diagnostics, polling, or an inactive adapter must not
            // cancel the active client's operation or replace its current status.
            guard.settings = settings;
            return guard.client_epoch;
        }

        guard.client_epoch = guard.client_epoch.wrapping_add(1);
        guard.settings = settings;
        guard.status = if context_change == ActiveClientContextChange::V2raynPath
            && !guard.settings.mock_mode_enabled
        {
            DashboardStatus::default()
        } else {
            status
        };
        guard.client_epoch
    }

    pub fn context_matches(&self, client_id: ProxyClientId, client_epoch: u64) -> bool {
        let guard = self.inner.lock().expect("AppState lock poisoned");
        guard.settings.selected_client == client_id && guard.client_epoch == client_epoch
    }

    pub fn update_status_if_context(
        &self,
        client_id: ProxyClientId,
        client_epoch: u64,
        status: DashboardStatus,
    ) -> bool {
        let mut guard = self.inner.lock().expect("AppState lock poisoned");
        if guard.settings.selected_client != client_id || guard.client_epoch != client_epoch {
            return false;
        }

        guard.status = status;
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::status::ConnectionState;

    fn connected_status() -> DashboardStatus {
        DashboardStatus {
            status: ConnectionState::Connected,
            connection_state: ConnectionState::Connected,
            tun_enabled: true,
            active_profile_name: Some("demo".to_owned()),
            ..DashboardStatus::default()
        }
    }

    #[test]
    fn stale_status_is_rejected_after_client_switch() {
        let state = AppState::new(AppSettings::default(), DashboardStatus::default());
        let before = state.snapshot();

        let mut next_settings = before.settings.clone();
        next_settings.selected_client = ProxyClientId::Happ;
        state.replace_settings_and_status(next_settings, DashboardStatus::default());

        assert!(!state.update_status_if_context(
            ProxyClientId::V2rayn,
            before.client_epoch,
            DashboardStatus::default(),
        ));
    }

    #[test]
    fn old_epoch_is_rejected_after_switching_away_and_back() {
        let state = AppState::new(AppSettings::default(), DashboardStatus::default());
        let original = state.snapshot();

        let mut settings = original.settings.clone();
        settings.selected_client = ProxyClientId::Happ;
        state.replace_settings_and_status(settings.clone(), DashboardStatus::default());
        settings.selected_client = ProxyClientId::V2rayn;
        state.replace_settings_and_status(settings, DashboardStatus::default());

        assert!(!state.update_status_if_context(
            ProxyClientId::V2rayn,
            original.client_epoch,
            DashboardStatus::default(),
        ));
    }

    #[test]
    fn unrelated_general_settings_preserve_active_context_and_status() {
        let state = AppState::new(AppSettings::default(), connected_status());
        let before = state.snapshot();
        let mut settings = before.settings.clone();
        settings.autostart_with_windows = true;
        settings.poll_interval_sec = 60;
        settings.diagnostics_enabled = true;

        state
            .replace_settings_and_status_invalidating_context(settings, DashboardStatus::default());

        let after = state.snapshot();
        assert_eq!(after.client_epoch, before.client_epoch);
        assert_eq!(after.status.connection_state, ConnectionState::Connected);
        assert_eq!(after.status.active_profile_name.as_deref(), Some("demo"));
    }

    #[test]
    fn inactive_happ_settings_preserve_v2rayn_context_and_status() {
        let state = AppState::new(AppSettings::default(), connected_status());
        let before = state.snapshot();
        let mut settings = before.settings.clone();
        settings.happ_path = Some("C:\\Apps\\Happ\\Happ.exe".to_owned());
        settings.happ_allow_ui_automation = true;

        state
            .replace_settings_and_status_invalidating_context(settings, DashboardStatus::default());

        let after = state.snapshot();
        assert_eq!(after.client_epoch, before.client_epoch);
        assert_eq!(after.status.connection_state, ConnectionState::Connected);
    }

    #[test]
    fn inactive_v2rayn_mock_setting_preserves_happ_context_and_status() {
        let settings = AppSettings {
            selected_client: ProxyClientId::Happ,
            ..AppSettings::default()
        };
        let state = AppState::new(settings.clone(), connected_status());
        let before = state.snapshot();
        let next = AppSettings {
            mock_mode_enabled: true,
            v2rayn_path: Some("C:\\Apps\\v2rayN".to_owned()),
            ..settings
        };

        state.replace_settings_and_status_invalidating_context(next, DashboardStatus::default());

        let after = state.snapshot();
        assert_eq!(after.client_epoch, before.client_epoch);
        assert_eq!(after.status.connection_state, ConnectionState::Connected);
    }

    #[test]
    fn active_v2rayn_path_change_invalidates_context_and_clears_stale_status() {
        let state = AppState::new(AppSettings::default(), connected_status());
        let before = state.snapshot();
        let mut settings = before.settings.clone();
        settings.v2rayn_path_mode = crate::models::settings::V2RayNPathMode::Manual;
        settings.v2rayn_path = Some("C:\\Apps\\v2rayN".to_owned());

        state.replace_settings_and_status_invalidating_context(settings, connected_status());

        let after = state.snapshot();
        assert_ne!(after.client_epoch, before.client_epoch);
        assert_eq!(after.status.connection_state, ConnectionState::Unknown);
        assert!(!after.status.tun_enabled);
    }

    #[test]
    fn active_v2rayn_mock_change_uses_the_supplied_mock_status() {
        let state = AppState::new(AppSettings::default(), connected_status());
        let before = state.snapshot();
        let mut settings = before.settings.clone();
        settings.mock_mode_enabled = true;
        let supplied = DashboardStatus {
            last_event: Some("mock enabled".to_owned()),
            ..connected_status()
        };

        state.replace_settings_and_status_invalidating_context(settings, supplied);

        let after = state.snapshot();
        assert_ne!(after.client_epoch, before.client_epoch);
        assert_eq!(after.status.last_event.as_deref(), Some("mock enabled"));
    }

    #[tokio::test]
    async fn v2rayn_operation_lock_serializes_commands() {
        let state = AppState::new(AppSettings::default(), DashboardStatus::default());
        let _first = state.lock_v2rayn_operation().await;
        assert!(state.v2rayn_operation_lock.try_lock().is_err());
    }

    #[test]
    fn window_position_revision_changes_only_for_a_new_position() {
        let state = AppState::new(AppSettings::default(), DashboardStatus::default());
        let position = WindowPosition {
            x: 10,
            y: 20,
            width: 360,
            height: 500,
        };

        let first = state
            .update_window_position(position.clone())
            .expect("first position is new");
        let unchanged = state.update_window_position(position);
        let second = state
            .update_window_position(WindowPosition {
                x: 11,
                y: 20,
                width: 360,
                height: 500,
            })
            .expect("changed position is new");

        assert!(unchanged.is_none());
        assert!(second > first);
        assert!(!state.window_position_revision_is_current(first));
        assert!(state.window_position_revision_is_current(second));
    }

    #[tokio::test]
    async fn happ_operation_lock_serializes_commands() {
        let state = AppState::new(AppSettings::default(), DashboardStatus::default());
        let _first = state.lock_happ_operation().await;
        assert!(state.happ_operation_lock.try_lock().is_err());
    }
}
