use std::sync::Mutex;

use crate::models::{settings::AppSettings, status::DashboardStatus};

#[derive(Debug, Clone)]
pub struct Snapshot {
    pub settings: AppSettings,
    pub status: DashboardStatus,
}

#[derive(Debug)]
struct AppStateInner {
    settings: AppSettings,
    status: DashboardStatus,
}

#[derive(Debug)]
pub struct AppState {
    inner: Mutex<AppStateInner>,
}

impl AppState {
    pub fn new(settings: AppSettings, status: DashboardStatus) -> Self {
        Self {
            inner: Mutex::new(AppStateInner { settings, status }),
        }
    }

    pub fn snapshot(&self) -> Snapshot {
        let guard = self.inner.lock().expect("AppState lock poisoned");
        Snapshot {
            settings: guard.settings.clone(),
            status: guard.status.clone(),
        }
    }

    pub fn update_settings(&self, settings: AppSettings) {
        let mut guard = self.inner.lock().expect("AppState lock poisoned");
        guard.settings = settings;
    }

    pub fn update_status(&self, status: DashboardStatus) {
        let mut guard = self.inner.lock().expect("AppState lock poisoned");
        guard.status = status;
    }
}
