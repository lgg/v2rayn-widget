pub mod happ;
pub mod v2rayn;

use crate::models::client::{ClientDescriptor, ProxyClientId};

pub fn catalog() -> Vec<ClientDescriptor> {
    vec![v2rayn::descriptor(), happ::descriptor()]
}

pub fn descriptor(client_id: ProxyClientId) -> ClientDescriptor {
    match client_id {
        ProxyClientId::V2rayn => v2rayn::descriptor(),
        ProxyClientId::Happ => happ::descriptor(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::client::CapabilityState;

    #[test]
    fn registry_contains_v2rayn_and_happ() {
        let entries = catalog();
        assert_eq!(entries.len(), 2);
        assert!(entries.iter().any(|entry| entry.id == ProxyClientId::V2rayn));
        assert!(entries.iter().any(|entry| entry.id == ProxyClientId::Happ));
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
