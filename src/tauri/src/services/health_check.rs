use std::time::Instant;

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
    for endpoint in endpoints {
        if let Ok(response) = client.get(endpoint).send().await {
            if !response.status().is_success() {
                continue;
            }

            if endpoint.contains("ipify") {
                if let Ok(json) = response.json::<serde_json::Value>().await {
                    if let Some(ip) = json.get("ip").and_then(|v| v.as_str()) {
                        return Some(ip.trim().to_owned());
                    }
                }
                continue;
            }

            if let Ok(text) = response.text().await {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_owned());
                }
            }
        }
    }

    None
}

pub fn build_http_client() -> Result<Client> {
    Ok(Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .build()?)
}
