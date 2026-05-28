use std::{net::IpAddr, time::Instant};

use anyhow::Result;
use reqwest::Client;

use crate::models::settings::LatencyMode;

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

pub async fn check(client: &Client, options: &HealthCheckOptions) -> HealthSnapshot {
    let mut snapshot = HealthSnapshot::default();

    if options.enable_connectivity_latency && matches!(options.latency_mode, LatencyMode::Active) {
        snapshot.connectivity_checked = true;
        if let Some((ok, latency)) = check_connectivity(client, &options.connectivity_endpoints).await {
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
        if let Ok(response) = client.get(endpoint).send().await {
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
    let response = client.get(&endpoint).send().await.ok()?;
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

fn normalize_ip_text(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.len() > 64 {
        return None;
    }

    trimmed
        .parse::<IpAddr>()
        .ok()
        .map(|ip| ip.to_string())
}

pub fn build_http_client() -> Result<Client> {
    Ok(Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .build()?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_ip_text_accepts_ipv4_and_ipv6() {
        let ipv4 = [203, 0, 113, 10]
            .map(|part| part.to_string())
            .join(".");
        let ipv6 = format!("{}:{}::{}", "2001", "db8", "1");

        assert_eq!(normalize_ip_text(&format!(" {ipv4} ")), Some(ipv4));
        assert_eq!(normalize_ip_text(&ipv6), Some(ipv6));
    }

    #[test]
    fn normalize_ip_text_rejects_html_and_long_responses() {
        let ipv4 = [203, 0, 113, 10]
            .map(|part| part.to_string())
            .join(".");

        assert_eq!(normalize_ip_text(&format!("<html>{ipv4}</html>")), None);
        assert_eq!(normalize_ip_text(&"1".repeat(65)), None);
    }
}

