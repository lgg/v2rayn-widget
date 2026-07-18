use std::sync::Mutex;

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

#[derive(Debug)]
pub struct AppState {
    inner: Mutex<AppStateInner>,
}

impl AppState {
    pub fn new(settings: AppSettings, status: DashboardStatus) -> Self {
        Self {
            inner: Mutex::new(AppStateInner {
                settings,
                status,
                client_epoch: 0,
            }),
        }
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

    pub fn update_window_position(&self, position: WindowPosition) -> AppSettings {
        let mut guard = self.inner.lock().expect("AppState lock poisoned");
        guard.settings.window_position = Some(position);
        guard.settings.clone()
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
        guard.client_epoch = guard.client_epoch.wrapping_add(1);
        guard.settings = settings;
        guard.status = status;
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
}
