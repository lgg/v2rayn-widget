use std::fs;

use anyhow::{Context, Result};

use crate::models::settings::{default_connectivity_endpoints, default_ip_endpoints, AppSettings};
use crate::utils::{app_paths, locale};

pub fn load_settings() -> Result<AppSettings> {
    let path = app_paths::settings_file_path()?;

    if !path.exists() {
        let defaults = AppSettings {
            language: locale::detect_default_language(),
            ..AppSettings::default()
        };
        save_settings(&defaults)?;
        return Ok(defaults);
    }

    let content = fs::read_to_string(&path)
        .with_context(|| format!("Failed to read settings file: {}", path.display()))?;

    let mut parsed: AppSettings = serde_json::from_str(&content)
        .with_context(|| format!("Failed to parse settings JSON: {}", path.display()))?;

    if parsed.language.trim().is_empty() {
        parsed.language = locale::detect_default_language();
    }

    if parsed.poll_interval_sec == 0 {
        parsed.poll_interval_sec = 10;
    }

    parsed.window_opacity_percent = parsed.window_opacity_percent.clamp(10, 100);

    parsed.v2rayn_path = parsed
        .v2rayn_path
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());

    if parsed.connectivity_endpoints.is_empty() {
        parsed.connectivity_endpoints = default_connectivity_endpoints();
    }

    if parsed.ip_endpoints.is_empty() {
        parsed.ip_endpoints = default_ip_endpoints();
    }

    Ok(parsed)
}

pub fn save_settings(settings: &AppSettings) -> Result<()> {
    let path = app_paths::settings_file_path()?;
    let parent = path
        .parent()
        .ok_or_else(|| anyhow::anyhow!("Could not resolve parent directory for settings"))?;

    fs::create_dir_all(parent)
        .with_context(|| format!("Failed to create settings directory: {}", parent.display()))?;

    let content = serde_json::to_string_pretty(settings)?;
    fs::write(&path, content)
        .with_context(|| format!("Failed to write settings file: {}", path.display()))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_roundtrip_json() {
        let initial = AppSettings::default();
        let json = serde_json::to_string(&initial).expect("serialize settings");
        let decoded: AppSettings = serde_json::from_str(&json).expect("deserialize settings");

        assert_eq!(decoded.poll_interval_sec, initial.poll_interval_sec);
        assert_eq!(decoded.language, initial.language);
        assert_eq!(decoded.window_opacity_percent, initial.window_opacity_percent);
    }
}
