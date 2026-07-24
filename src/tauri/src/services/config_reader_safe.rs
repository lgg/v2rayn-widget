use std::{fs, path::Path, sync::Mutex};

use anyhow::{Context, Result};
use once_cell::sync::Lazy;
use serde_json::Value;

use crate::utils::file_store;

use super::config_reader_legacy;

pub use config_reader_legacy::ConfigSnapshot;

static CONFIG_WRITE_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

const PROFILE_COLLECTION_KEYS: &[&str] = &[
    "profiles",
    "servers",
    "vmess",
    "configs",
    "profileItem",
    "ProfileItem",
];

const PROFILE_ID_SELECTOR_KEYS: &[&str] = &[
    "IndexId",
    "indexId",
    "SubIndexId",
    "subIndexId",
    "selectedProfileId",
    "selectedServerId",
];

const PROFILE_NAME_SELECTOR_KEYS: &[&str] =
    &["activeProfileName", "activeServerName", "currentProfile"];

pub fn read_config(base_path: &Path) -> Result<ConfigSnapshot> {
    config_reader_legacy::read_config(base_path)
}

pub fn read_primary_config(base_path: &Path) -> Result<ConfigSnapshot> {
    config_reader_legacy::read_primary_config(base_path)
}

pub fn toggle_tun_mode(base_path: &Path) -> Result<bool> {
    let _write_guard = lock_config_writes()?;
    config_reader_legacy::toggle_tun_mode(base_path)
}

pub fn set_tun_mode(base_path: &Path, enabled: bool) -> Result<bool> {
    let _write_guard = lock_config_writes()?;
    config_reader_legacy::set_tun_mode(base_path, enabled)
}

pub fn set_active_profile(base_path: &Path, profile_id: &str) -> Result<()> {
    let _write_guard = lock_config_writes()?;
    let config_path = base_path.join("guiConfigs").join("guiNConfig.json");
    let original_content = read_primary_object(&config_path)?;
    let mut json: Value = serde_json::from_str(&original_content)
        .with_context(|| format!("Failed to parse config JSON: {}", config_path.display()))?;

    let snapshot = config_reader_legacy::read_primary_config(base_path)?;
    let target = snapshot
        .profiles
        .iter()
        .find(|item| item.id == profile_id)
        .ok_or_else(|| anyhow::anyhow!("Profile not found: {profile_id}"))?;

    if !set_first_existing_string_key(&mut json, PROFILE_ID_SELECTOR_KEYS, &target.id) {
        return Err(anyhow::anyhow!(
            "Could not locate an existing string profile selector; refusing to invent or retype v2rayN config fields"
        ));
    }

    let _ = set_first_existing_string_key(&mut json, PROFILE_NAME_SELECTOR_KEYS, &target.name);

    let serialized = serde_json::to_string_pretty(&json)
        .with_context(|| format!("Failed to serialize config JSON: {}", config_path.display()))?;

    replace_config_if_unchanged(&config_path, &original_content, serialized.as_bytes())
        .with_context(|| format!("Failed to write config: {}", config_path.display()))
}

fn lock_config_writes() -> Result<std::sync::MutexGuard<'static, ()>> {
    CONFIG_WRITE_LOCK
        .lock()
        .map_err(|_| anyhow::anyhow!("v2rayN config write lock is poisoned"))
}

fn read_primary_object(config_path: &Path) -> Result<String> {
    let content = fs::read_to_string(config_path).with_context(|| {
        format!(
            "Failed to read primary config for update; refusing to restore or mutate a backup: {}",
            config_path.display()
        )
    })?;

    if !serde_json::from_str::<Value>(&content).is_ok_and(|value| value.is_object()) {
        return Err(anyhow::anyhow!(
            "Primary config is invalid; refusing to mutate external v2rayN config: {}",
            config_path.display()
        ));
    }

    Ok(content)
}

fn replace_config_if_unchanged(
    config_path: &Path,
    original_content: &str,
    replacement: &[u8],
) -> Result<()> {
    let current_content = fs::read_to_string(config_path).with_context(|| {
        format!(
            "Failed to re-read config before guarded update: {}",
            config_path.display()
        )
    })?;

    if current_content != original_content {
        return Err(anyhow::anyhow!(
            "v2rayN config changed while the widget was preparing an update; refusing to overwrite concurrent changes"
        ));
    }

    file_store::replace_with_backup(config_path, replacement)
}

fn is_profile_collection_key(key: &str) -> bool {
    PROFILE_COLLECTION_KEYS.contains(&key)
}

fn set_first_existing_string_key(value: &mut Value, keys: &[&str], new_value: &str) -> bool {
    let Value::Object(map) = value else {
        return false;
    };

    for key in keys {
        if map.get(*key).is_some_and(Value::is_string) {
            map.insert((*key).to_owned(), Value::String(new_value.to_owned()));
            return true;
        }
    }

    for (key, child) in map.iter_mut() {
        if is_profile_collection_key(key) || !child.is_object() {
            continue;
        }

        if set_first_existing_string_key(child, keys, new_value) {
            return true;
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_config(prefix: &str, json: Value) -> (std::path::PathBuf, std::path::PathBuf) {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let base_path = std::env::temp_dir().join(format!("{prefix}-{unique}"));
        let config_dir = base_path.join("guiConfigs");
        fs::create_dir_all(&config_dir).expect("create config dir");
        let config_path = config_dir.join("guiNConfig.json");
        fs::write(&config_path, json.to_string()).expect("write config");
        (base_path, config_path)
    }

    fn profiles_without_selector() -> Value {
        serde_json::json!({
            "ProfileItem": [
                { "IndexId": "first", "Remarks": "First profile" },
                { "IndexId": "second", "Remarks": "Second profile" }
            ]
        })
    }

    #[test]
    fn existing_id_selector_is_updated_without_rewriting_profile_records() {
        let (base_path, config_path) = test_config(
            "v2rayn-widget-safe-profile-selector",
            serde_json::json!({
                "IndexId": "first",
                "activeProfileName": "First profile",
                "ProfileItem": [
                    { "IndexId": "first", "Remarks": "First profile" },
                    { "IndexId": "second", "Remarks": "Second profile" }
                ]
            }),
        );

        set_active_profile(&base_path, "second").expect("set profile");
        let updated: Value =
            serde_json::from_str(&fs::read_to_string(&config_path).expect("read updated config"))
                .expect("parse updated config");

        assert_eq!(
            updated.get("IndexId").and_then(Value::as_str),
            Some("second")
        );
        assert_eq!(
            updated.get("activeProfileName").and_then(Value::as_str),
            Some("Second profile")
        );
        let ids = updated
            .get("ProfileItem")
            .and_then(Value::as_array)
            .expect("profile array")
            .iter()
            .filter_map(|item| item.get("IndexId").and_then(Value::as_str))
            .collect::<Vec<_>>();
        assert_eq!(ids, vec!["first", "second"]);

        let _ = fs::remove_dir_all(base_path);
    }

    #[test]
    fn missing_id_selector_is_rejected_without_modifying_config() {
        let original = profiles_without_selector().to_string();
        let (base_path, config_path) = test_config(
            "v2rayn-widget-missing-profile-selector",
            profiles_without_selector(),
        );

        let error = set_active_profile(&base_path, "second").expect_err("reject unknown schema");

        assert!(error.to_string().contains("refusing to invent or retype"));
        assert_eq!(
            fs::read_to_string(&config_path).expect("read untouched config"),
            original
        );
        assert!(!config_path.with_extension("json.bak").exists());

        let _ = fs::remove_dir_all(base_path);
    }

    #[test]
    fn name_only_selector_is_rejected_without_inventing_index_id() {
        let json = serde_json::json!({
            "activeProfileName": "First profile",
            "ProfileItem": [
                { "IndexId": "first", "Remarks": "First profile" },
                { "IndexId": "second", "Remarks": "Second profile" }
            ]
        });
        let original = json.to_string();
        let (base_path, config_path) =
            test_config("v2rayn-widget-name-only-profile-selector", json);

        assert!(set_active_profile(&base_path, "second").is_err());
        assert_eq!(
            fs::read_to_string(&config_path).expect("read untouched config"),
            original
        );

        let _ = fs::remove_dir_all(base_path);
    }

    #[test]
    fn selector_inside_profile_records_is_not_treated_as_application_state() {
        let json = profiles_without_selector();
        let original = json.to_string();
        let (base_path, config_path) = test_config("v2rayn-widget-profile-record-selector", json);

        assert!(set_active_profile(&base_path, "second").is_err());
        assert_eq!(
            fs::read_to_string(&config_path).expect("read untouched config"),
            original
        );

        let _ = fs::remove_dir_all(base_path);
    }
}
