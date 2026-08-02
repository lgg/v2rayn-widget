use std::{
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
};

use tauri::State;
use tracing::warn;

use crate::{
    commands,
    models::{
        client::{CapabilityState, ClientCapabilities, ClientDescriptor, ProxyClientId},
        profile::ProfileSummary,
        status::DashboardStatus,
    },
    services::config_reader,
    state::app_state::AppState,
};

#[derive(Debug, Default)]
struct ProfileCache {
    base_path: Option<PathBuf>,
    profiles: Vec<ProfileSummary>,
}

fn profile_cache() -> &'static Mutex<ProfileCache> {
    static CACHE: OnceLock<Mutex<ProfileCache>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(ProfileCache::default()))
}

fn cache_profiles(base_path: &Path, profiles: &[ProfileSummary]) {
    let mut cache = profile_cache()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    cache.base_path = Some(base_path.to_path_buf());
    cache.profiles = profiles.to_vec();
}

fn cached_profiles(base_path: &Path) -> Option<Vec<ProfileSummary>> {
    let cache = profile_cache()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    (cache.base_path.as_deref() == Some(base_path)).then(|| cache.profiles.clone())
}

pub fn descriptor() -> ClientDescriptor {
    ClientDescriptor {
        id: ProxyClientId::V2rayn,
        display_name: "v2rayN".to_owned(),
        maturity: "stable_with_experimental_profile_switching".to_owned(),
        status_note: "Current v2rayN TUN integration is preserved behind an adapter boundary. Generic transport-mode reporting and all subscription operations are not supported.".to_owned(),
        capabilities: ClientCapabilities {
            detect_application: CapabilityState::Supported,
            read_process_state: CapabilityState::Supported,
            read_connection_state: CapabilityState::Supported,
            open_application: CapabilityState::Supported,
            toggle_connection: CapabilityState::Supported,
            list_items: CapabilityState::Supported,
            select_item: CapabilityState::Experimental,
            restart_application: CapabilityState::Supported,
            read_transport_mode: CapabilityState::Unsupported,
            list_subscriptions: CapabilityState::Unsupported,
            switch_subscription: CapabilityState::Unsupported,
            refresh_subscription: CapabilityState::Unsupported,
            manage_subscriptions: CapabilityState::Unsupported,
        },
    }
}

pub async fn refresh(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    commands::refresh_status(state).await
}

pub async fn refresh_background(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    commands::refresh_status_background(state).await
}

pub async fn refresh_startup(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    commands::refresh_status_startup(state).await
}

pub async fn refresh_post_route(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    commands::refresh_status_post_route(state).await
}

pub async fn toggle(state: State<'_, AppState>) -> Result<DashboardStatus, String> {
    commands::toggle_tun_via_ui(state).await
}

pub async fn list_items(state: State<'_, AppState>) -> Result<Vec<ProfileSummary>, String> {
    let requested_context = state.snapshot();

    // Keep mock behavior owned by the legacy command. It already serializes the
    // v2rayN operation and returns the deterministic mock profile catalog.
    if requested_context.settings.mock_mode_enabled {
        return commands::list_profiles(state).await;
    }

    let _v2rayn_operation = state.lock_v2rayn_operation().await;
    if !state.context_matches(ProxyClientId::V2rayn, requested_context.client_epoch) {
        return Err(
            "CLIENT_CONTEXT_CHANGED: selected proxy client changed before the v2rayN profile read started"
                .to_owned(),
        );
    }

    let snapshot = state.snapshot();
    let Some(base_path) = commands::resolve_v2rayn_base_path(&snapshot.settings) else {
        return Ok(Vec::new());
    };

    let profiles = match config_reader::read_config(&base_path) {
        Ok(config) => {
            cache_profiles(&base_path, &config.profiles);
            config.profiles
        }
        Err(error) => {
            if let Some(profiles) = cached_profiles(&base_path) {
                warn!(
                    ?error,
                    base_path = %base_path.display(),
                    "profile read failed; preserving the last successful catalog for the same v2rayN installation"
                );
                profiles
            } else {
                return Err(format!("Could not list v2rayN profiles: {error}"));
            }
        }
    };

    if state.context_matches(ProxyClientId::V2rayn, snapshot.client_epoch) {
        Ok(profiles)
    } else {
        Err(
            "CLIENT_CONTEXT_CHANGED: selected proxy client changed while v2rayN profiles were being read"
                .to_owned(),
        )
    }
}

pub async fn select_item(
    item_id: String,
    state: State<'_, AppState>,
) -> Result<DashboardStatus, String> {
    commands::set_active_profile(item_id, state).await
}

pub async fn open(state: State<'_, AppState>) -> Result<(), String> {
    commands::open_v2rayn(state).await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn profile(id: &str) -> ProfileSummary {
        ProfileSummary {
            id: id.to_owned(),
            name: format!("profile-{id}"),
        }
    }

    #[test]
    fn profile_cache_distinguishes_empty_success_from_a_different_installation() {
        let first = Path::new("C:\\Apps\\v2rayN-a");
        let second = Path::new("C:\\Apps\\v2rayN-b");

        cache_profiles(first, &[profile("one")]);
        assert_eq!(cached_profiles(first).map(|items| items.len()), Some(1));
        assert!(cached_profiles(second).is_none());

        cache_profiles(first, &[]);
        assert_eq!(cached_profiles(first).map(|items| items.len()), Some(0));
    }
}
