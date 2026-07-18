pub mod happ;
pub mod v2rayn;

use crate::models::client::{ClientDescriptor, ProxyClientId};

pub trait ProxyClientAdapter: Send + Sync {
    fn id(&self) -> ProxyClientId;
    fn descriptor(&self) -> ClientDescriptor;
}

struct V2RayNAdapter;
struct HappAdapter;

impl ProxyClientAdapter for V2RayNAdapter {
    fn id(&self) -> ProxyClientId {
        ProxyClientId::V2rayn
    }

    fn descriptor(&self) -> ClientDescriptor {
        v2rayn::descriptor()
    }
}

impl ProxyClientAdapter for HappAdapter {
    fn id(&self) -> ProxyClientId {
        ProxyClientId::Happ
    }

    fn descriptor(&self) -> ClientDescriptor {
        happ::descriptor()
    }
}

static V2RAYN_ADAPTER: V2RayNAdapter = V2RayNAdapter;
static HAPP_ADAPTER: HappAdapter = HappAdapter;

fn registered_adapters() -> [&'static dyn ProxyClientAdapter; 2] {
    [&V2RAYN_ADAPTER, &HAPP_ADAPTER]
}

pub fn catalog() -> Vec<ClientDescriptor> {
    registered_adapters()
        .into_iter()
        .map(|adapter| adapter.descriptor())
        .collect()
}

pub fn adapter(client_id: ProxyClientId) -> &'static dyn ProxyClientAdapter {
    registered_adapters()
        .into_iter()
        .find(|adapter| adapter.id() == client_id)
        .expect("all ProxyClientId variants must have a registered adapter")
}

pub fn descriptor(client_id: ProxyClientId) -> ClientDescriptor {
    adapter(client_id).descriptor()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::client::CapabilityState;

    #[test]
    fn registry_contains_v2rayn_and_happ() {
        let entries = catalog();
        assert_eq!(entries.len(), 2);
        assert!(entries
            .iter()
            .any(|entry| entry.id == ProxyClientId::V2rayn));
        assert!(entries
            .iter()
            .any(|entry| entry.id == ProxyClientId::Happ));
    }

    #[test]
    fn every_client_id_resolves_through_adapter_trait() {
        assert_eq!(
            adapter(ProxyClientId::V2rayn).id(),
            ProxyClientId::V2rayn
        );
        assert_eq!(adapter(ProxyClientId::Happ).id(), ProxyClientId::Happ);
    }

    #[test]
    fn v2rayn_subscriptions_are_explicitly_unsupported() {
        let entry = descriptor(ProxyClientId::V2rayn);
        assert_eq!(
            entry.capabilities.switch_subscription,
            CapabilityState::Unsupported
        );
        assert_eq!(
            entry.capabilities.manage_subscriptions,
            CapabilityState::Unsupported
        );
    }
}
