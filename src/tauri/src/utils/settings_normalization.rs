use std::{collections::HashSet, net::IpAddr};

use reqwest::Url;

use crate::{
    models::settings::{
        default_connectivity_endpoints, default_diagnostics_url, default_ip_endpoints, AppSettings,
    },
    services::health_check,
    utils::locale,
};

pub const MAX_ENDPOINTS_PER_LIST: usize = 8;
pub const MAX_ENDPOINT_URL_LENGTH: usize = 2_048;
pub const MAX_POLL_INTERVAL_SEC: u64 = 3_600;
pub const MIN_POLL_INTERVAL_SEC: u64 = 1;

pub fn normalize_settings(mut settings: AppSettings) -> AppSettings {
    settings.language = normalize_language(&settings.language);
    settings.poll_interval_sec = settings
        .poll_interval_sec
        .clamp(MIN_POLL_INTERVAL_SEC, MAX_POLL_INTERVAL_SEC);
    settings.window_opacity_percent = settings.window_opacity_percent.clamp(10, 100);
    settings.v2rayn_path = normalize_optional_path(settings.v2rayn_path);
    settings.happ_path = normalize_optional_path(settings.happ_path);
    settings.diagnostics_url = normalize_diagnostics_url(&settings.diagnostics_url)
        .map(|url| url.to_string())
        .unwrap_or_else(default_diagnostics_url);
    settings.connectivity_endpoints = normalize_endpoint_list(
        settings.connectivity_endpoints,
        default_connectivity_endpoints(),
    );
    settings.ip_endpoints = normalize_endpoint_list(settings.ip_endpoints, default_ip_endpoints());
    settings
}

pub fn normalize_language(value: &str) -> String {
    let normalized = value.trim().to_lowercase();
    if normalized.starts_with("ru") {
        "ru".to_owned()
    } else if normalized.starts_with("en") {
        "en".to_owned()
    } else {
        locale::detect_default_language()
    }
}

pub fn normalize_diagnostics_url(value: &str) -> Option<Url> {
    let trimmed = value.trim();
    let candidate = if trimmed.is_empty() {
        default_diagnostics_url()
    } else if trimmed.contains("://") {
        trimmed.to_owned()
    } else {
        format!("https://{trimmed}")
    };

    let url = Url::parse(&candidate).ok()?;
    match url.scheme() {
        "http" | "https" if url.host_str().is_some() => Some(url),
        _ => None,
    }
}

pub fn normalize_optional_path(value: Option<String>) -> Option<String> {
    value
        .map(|path| path.trim().to_owned())
        .filter(|path| !path.is_empty())
}

pub fn normalize_endpoint_list(values: Vec<String>, fallback: Vec<String>) -> Vec<String> {
    let filtered = normalize_endpoint_entries(values);
    if filtered.is_empty() {
        normalize_endpoint_entries(fallback)
    } else {
        filtered
    }
}

fn normalize_endpoint_entries(values: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    values
        .into_iter()
        .filter_map(|value| parse_allowed_http_endpoint(&value))
        .map(|url| url.to_string())
        .filter(|value| seen.insert(value.clone()))
        .take(MAX_ENDPOINTS_PER_LIST)
        .collect()
}

#[cfg(test)]
pub fn is_allowed_http_endpoint(value: &str) -> bool {
    parse_allowed_http_endpoint(value).is_some()
}

fn parse_allowed_http_endpoint(value: &str) -> Option<Url> {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.len() > MAX_ENDPOINT_URL_LENGTH {
        return None;
    }

    let url = Url::parse(trimmed).ok()?;
    if !matches!(url.scheme(), "http" | "https") {
        return None;
    }

    let host = url.host_str()?;
    is_allowed_endpoint_host(host).then_some(url)
}

fn is_allowed_endpoint_host(host: &str) -> bool {
    let host = host.trim().trim_matches(['[', ']']).to_lowercase();
    if host.is_empty()
        || host == "localhost"
        || host.ends_with(".localhost")
        || host.ends_with(".local")
        || host.ends_with(".lan")
        || host.ends_with(".internal")
        || host.ends_with(".home.arpa")
        || host.ends_with(".test")
        || host.ends_with(".invalid")
    {
        return false;
    }

    host.parse::<IpAddr>()
        .map(health_check::is_public_endpoint_ip)
        .unwrap_or(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_corrupt_loaded_values() {
        let settings = AppSettings {
            language: "unsupported".to_owned(),
            poll_interval_sec: u64::MAX,
            window_opacity_percent: 1,
            diagnostics_url: "javascript:alert(1)".to_owned(),
            connectivity_endpoints: vec!["http://localhost/".to_owned()],
            ip_endpoints: vec!["not a url".to_owned()],
            v2rayn_path: Some("   ".to_owned()),
            happ_path: Some("  C:\\Happ\\Happ.exe  ".to_owned()),
            ..AppSettings::default()
        };

        let normalized = normalize_settings(settings);
        assert!(matches!(normalized.language.as_str(), "en" | "ru"));
        assert_eq!(normalized.poll_interval_sec, MAX_POLL_INTERVAL_SEC);
        assert_eq!(normalized.window_opacity_percent, 10);
        assert_eq!(normalized.diagnostics_url, default_diagnostics_url());
        assert_eq!(
            normalized.connectivity_endpoints,
            default_connectivity_endpoints()
        );
        assert_eq!(normalized.ip_endpoints, default_ip_endpoints());
        assert!(normalized.v2rayn_path.is_none());
        assert_eq!(normalized.happ_path.as_deref(), Some("C:\\Happ\\Happ.exe"));
    }

    #[test]
    fn endpoint_lists_are_deduplicated_bounded_and_length_limited() {
        let mut values = vec![
            "https://example.com/a".to_owned(),
            "https://EXAMPLE.com/a".to_owned(),
            format!(
                "https://example.com/{}",
                "x".repeat(MAX_ENDPOINT_URL_LENGTH)
            ),
        ];
        values.extend((0..20).map(|index| format!("https://example{index}.com/check")));

        let normalized = normalize_endpoint_list(values, default_connectivity_endpoints());
        assert_eq!(normalized.len(), MAX_ENDPOINTS_PER_LIST);
        assert_eq!(normalized[0], "https://example.com/a");
        assert!(normalized
            .iter()
            .all(|value| value.len() <= MAX_ENDPOINT_URL_LENGTH));
    }

    #[test]
    fn endpoint_validation_rejects_local_and_non_http_targets() {
        for value in [
            "file:///etc/passwd",
            "http://localhost/check",
            "http://127.0.0.1/check",
            "http://router.local/check",
            "https://example.invalid/check",
        ] {
            assert!(!is_allowed_http_endpoint(value), "accepted {value}");
        }
        assert!(is_allowed_http_endpoint("https://1.1.1.1/check"));
        assert!(is_allowed_http_endpoint("https://example.com/check"));
    }
}
