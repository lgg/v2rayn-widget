use std::{
    net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr},
    time::Instant,
};

use anyhow::Result;
use reqwest::{redirect::Policy, Client, ClientBuilder, Response, Url};

use crate::models::settings::LatencyMode;

const REQUEST_TIMEOUT_SECONDS: u64 = 4;

#[derive(Debug, Clone, Default)]
pub struct HealthSnapshot {
    pub health_ok: bool,
    pub connectivity_checked: bool,
    pub external_ip_checked: bool,
    pub external_ip: Option<String>,
    pub latency_ms: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct HealthCheckOptions {
    pub enable_external_ip: bool,
    pub enable_connectivity_latency: bool,
    pub latency_mode: LatencyMode,
    pub connectivity_endpoints: Vec<String>,
    pub ip_endpoints: Vec<String>,
}

#[derive(Debug, Clone)]
struct ResolvedPublicEndpoint {
    url: Url,
    domain: Option<String>,
    addresses: Vec<SocketAddr>,
}

pub async fn check(client: &Client, options: &HealthCheckOptions) -> HealthSnapshot {
    let mut snapshot = HealthSnapshot::default();

    if options.enable_connectivity_latency && matches!(options.latency_mode, LatencyMode::Active) {
        snapshot.connectivity_checked = true;
        if let Some((ok, latency)) =
            check_connectivity(client, &options.connectivity_endpoints).await
        {
            snapshot.health_ok = ok;
            snapshot.latency_ms = latency;
        }
    }

    if options.enable_external_ip {
        snapshot.external_ip_checked = true;
        snapshot.external_ip = fetch_external_ip(client, &options.ip_endpoints).await;
    }

    snapshot
}

async fn check_connectivity(client: &Client, endpoints: &[String]) -> Option<(bool, Option<u64>)> {
    for endpoint in endpoints {
        let start = Instant::now();
        if let Some(response) = send_public_get(client, endpoint).await {
            if response.status().is_success() {
                let elapsed = start.elapsed().as_millis() as u64;
                return Some((true, Some(elapsed)));
            }
        }
    }

    Some((false, None))
}

async fn fetch_external_ip(client: &Client, endpoints: &[String]) -> Option<String> {
    let mut workers = tokio::task::JoinSet::new();

    for endpoint in endpoints {
        let endpoint = endpoint.clone();
        let client = client.clone();

        workers.spawn(async move { fetch_external_ip_from_endpoint(client, endpoint).await });
    }

    while let Some(result) = workers.join_next().await {
        if let Ok(Some(ip)) = result {
            workers.abort_all();
            return Some(ip);
        }
    }

    None
}

async fn fetch_external_ip_from_endpoint(client: Client, endpoint: String) -> Option<String> {
    let response = send_public_get(&client, &endpoint).await?;
    if !response.status().is_success() {
        return None;
    }

    if endpoint.contains("ipify") {
        let json = response.json::<serde_json::Value>().await.ok()?;
        let ip = json.get("ip").and_then(|value| value.as_str())?;
        normalize_ip_text(ip)
    } else {
        let text = response.text().await.ok()?;
        normalize_ip_text(&text)
    }
}

async fn send_public_get(client: &Client, endpoint: &str) -> Option<Response> {
    let resolved = resolve_public_endpoint(endpoint).await?;
    let request_client = if resolved.domain.is_some() {
        build_pinned_http_client(&resolved).ok()?
    } else {
        client.clone()
    };

    request_client.get(resolved.url).send().await.ok()
}

fn normalize_ip_text(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.len() > 64 {
        return None;
    }

    trimmed.parse::<IpAddr>().ok().map(|ip| ip.to_string())
}

async fn resolve_public_endpoint(endpoint: &str) -> Option<ResolvedPublicEndpoint> {
    let url = Url::parse(endpoint).ok()?;
    if !matches!(url.scheme(), "http" | "https") {
        return None;
    }

    let host = url.host_str()?.to_owned();
    let port = url.port_or_known_default()?;

    if let Ok(ip) = host.parse::<IpAddr>() {
        if !is_public_endpoint_ip(ip) {
            return None;
        }

        return Some(ResolvedPublicEndpoint {
            url,
            domain: None,
            addresses: vec![SocketAddr::new(ip, port)],
        });
    }

    let resolved = tokio::net::lookup_host((host.as_str(), port)).await.ok()?;
    let mut addresses = Vec::new();

    for address in resolved {
        if !is_public_endpoint_ip(address.ip()) {
            return None;
        }

        if !addresses.contains(&address) {
            addresses.push(address);
        }
    }

    if addresses.is_empty() {
        return None;
    }

    Some(ResolvedPublicEndpoint {
        url,
        domain: Some(host),
        addresses,
    })
}

fn http_client_builder() -> ClientBuilder {
    Client::builder()
        .no_proxy()
        .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECONDS))
        .redirect(Policy::none())
}

fn build_pinned_http_client(endpoint: &ResolvedPublicEndpoint) -> Result<Client> {
    let mut builder = http_client_builder();
    if let Some(domain) = endpoint.domain.as_deref() {
        builder = builder.resolve_to_addrs(domain, &endpoint.addresses);
    }

    Ok(builder.build()?)
}

pub(crate) fn is_public_endpoint_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(address) => is_public_ipv4(address),
        IpAddr::V6(address) => is_public_ipv6(address),
    }
}

fn is_public_ipv4(address: Ipv4Addr) -> bool {
    if address.is_private()
        || address.is_loopback()
        || address.is_link_local()
        || address.is_broadcast()
        || address.is_documentation()
        || address.is_unspecified()
        || address.is_multicast()
    {
        return false;
    }

    let [first, second, third, _] = address.octets();
    !(first == 0
        || (first == 100 && (64..=127).contains(&second))
        || (first == 192 && second == 0 && third == 0)
        || (first == 192 && second == 88 && third == 99)
        || (first == 198 && matches!(second, 18 | 19))
        || first >= 240)
}

fn is_public_ipv6(address: Ipv6Addr) -> bool {
    if let Some(mapped) = address.to_ipv4_mapped() {
        return is_public_ipv4(mapped);
    }

    if address.is_loopback()
        || address.is_unspecified()
        || address.is_unique_local()
        || address.is_unicast_link_local()
        || address.is_multicast()
    {
        return false;
    }

    let segments = address.segments();
    !(segments[..6].iter().all(|segment| *segment == 0)
        || (segments[0] == 0x0064 && segments[1] == 0xff9b && matches!(segments[2], 0 | 1))
        || (segments[0] == 0x0100 && segments[1..4] == [0, 0, 0])
        || (segments[0] == 0x2001 && segments[1] == 0)
        || (segments[0] == 0x2001 && segments[1] == 0x0002 && segments[2] == 0)
        || (segments[0] == 0x2001 && segments[1] == 0x0db8)
        || (segments[0] == 0x2001 && (0x0010..=0x001f).contains(&segments[1]))
        || segments[0] == 0x2002)
}

pub fn build_http_client() -> Result<Client> {
    Ok(http_client_builder().build()?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn public_endpoint_ip_rejects_internal_reserved_and_multicast_ranges() {
        let rejected = [
            "10.0.0.1",
            "100.64.0.1",
            "127.0.0.1",
            "169.254.1.1",
            "192.168.1.1",
            "198.18.0.1",
            "224.0.0.1",
            "240.0.0.1",
            "::1",
            "fc00::1",
            "fe80::1",
            "ff02::1",
            "64:ff9b::1.1.1.1",
            "64:ff9b:1::1.1.1.1",
            "100::1",
            "2001::1",
            "2001:2::1",
            "2001:db8::1",
            "2002:7f00:1::1",
            "::ffff:127.0.0.1",
            "::1.1.1.1",
        ];

        for value in rejected {
            let ip = value.parse::<IpAddr>().expect("valid test address");
            assert!(!is_public_endpoint_ip(ip), "{value} must be rejected");
        }

        assert!(is_public_endpoint_ip(
            "1.1.1.1".parse().expect("valid public IPv4")
        ));
        assert!(is_public_endpoint_ip(
            "2606:4700:4700::1111".parse().expect("valid public IPv6")
        ));
    }

    #[tokio::test]
    async fn endpoint_resolution_rejects_literal_loopback_without_requesting_it() {
        assert!(resolve_public_endpoint("http://127.0.0.1/check")
            .await
            .is_none());
        assert!(resolve_public_endpoint("http://[::1]/check")
            .await
            .is_none());
    }

    #[tokio::test]
    async fn public_literal_endpoint_keeps_the_verified_socket_address() {
        let resolved = resolve_public_endpoint("http://1.1.1.1:8080/check")
            .await
            .expect("public literal endpoint");

        assert_eq!(resolved.domain, None);
        assert_eq!(
            resolved.addresses,
            vec!["1.1.1.1:8080".parse().expect("valid socket address")]
        );
    }

    #[test]
    fn domain_client_can_be_pinned_to_prevalidated_addresses() {
        let endpoint = ResolvedPublicEndpoint {
            url: Url::parse("https://example.invalid/check").expect("valid URL"),
            domain: Some("example.invalid".to_owned()),
            addresses: vec!["1.1.1.1:443".parse().expect("valid socket address")],
        };

        build_pinned_http_client(&endpoint).expect("pinned client");
    }

    #[test]
    fn normalize_ip_text_accepts_ipv4_and_ipv6() {
        let ipv4 = [203, 0, 113, 10].map(|part| part.to_string()).join(".");
        let ipv6 = format!("{}:{}::{}", "2001", "db8", "1");

        assert_eq!(normalize_ip_text(&format!(" {ipv4} ")), Some(ipv4));
        assert_eq!(normalize_ip_text(&ipv6), Some(ipv6));
    }

    #[test]
    fn normalize_ip_text_rejects_html_and_long_responses() {
        let ipv4 = [203, 0, 113, 10].map(|part| part.to_string()).join(".");

        assert_eq!(normalize_ip_text(&format!("<html>{ipv4}</html>")), None);
        assert_eq!(normalize_ip_text(&"1".repeat(65)), None);
    }
}
