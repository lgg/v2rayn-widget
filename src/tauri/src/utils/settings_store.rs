use std::{fs, sync::Mutex};

use anyhow::{Context, Result};
use once_cell::sync::Lazy;
use tracing::warn;

use crate::models::settings::AppSettings;
use crate::utils::{app_paths, file_store, locale, settings_normalization};

static SETTINGS_WRITE_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

pub fn load_settings() -> Result<AppSettings> {
    let path = app_paths::settings_file_path()?;
    file_store::recover_backup_if_missing(&path)?;

    if !path.exists() {
        let defaults = AppSettings {
            language: locale::detect_default_language(),
            ..AppSettings::default()
        };
        save_settings(&defaults)?;
        return Ok(defaults);
    }

    let content = file_store::read_validated_string(&path, |value| {
        serde_json::from_str::<AppSettings>(value).is_ok()
    })
    .with_context(|| format!("Failed to read valid settings file: {}", path.display()))?;

    let parsed: AppSettings = serde_json::from_str(&content)
        .with_context(|| format!("Failed to parse settings JSON: {}", path.display()))?;
    let normalized = settings_normalization::normalize_settings(parsed.clone());

    if normalized != parsed {
        if let Err(error) = save_settings(&normalized) {
            warn!(
                ?error,
                path = %path.display(),
                "loaded settings were normalized in memory but could not be persisted"
            );
        }
    }

    Ok(normalized)
}

pub fn save_settings(settings: &AppSettings) -> Result<()> {
    let _write_guard = SETTINGS_WRITE_LOCK
        .lock()
        .map_err(|_| anyhow::anyhow!("Settings write lock is poisoned"))?;
    let path = app_paths::settings_file_path()?;
    let parent = path
        .parent()
        .ok_or_else(|| anyhow::anyhow!("Could not resolve parent directory for settings"))?;

    fs::create_dir_all(parent)
        .with_context(|| format!("Failed to create settings directory: {}", parent.display()))?;

    let content = serde_json::to_string_pretty(settings)?;
    file_store::replace_with_backup(&path, content.as_bytes())
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
        assert_eq!(
            decoded.window_opacity_percent,
            initial.window_opacity_percent
        );
        assert_eq!(decoded.diagnostics_enabled, initial.diagnostics_enabled);
        assert_eq!(decoded.diagnostics_url, initial.diagnostics_url);
    }
}
