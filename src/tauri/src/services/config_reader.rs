use std::{fs, path::Path, path::PathBuf, sync::Mutex};

use anyhow::{Context, Result};
use once_cell::sync::Lazy;
use rusqlite::Connection;
use serde_json::Value;

use crate::{models::profile::ProfileSummary, utils::file_store};

static CONFIG_WRITE_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

const PROFILE_COLLECTION_KEYS: &[&str] = &[
    "profiles",
    "servers",
    "vmess",
    "configs",
    "profileItem",
    "ProfileItem",
];

#[derive(Debug, Clone, Default)]
pub struct ConfigSnapshot {
    pub enable_tun: Option<bool>,
    pub active_profile_name: Option<String>,
    pub profiles: Vec<ProfileSummary>,
}

pub fn read_config(base_path: &Path) -> Result<ConfigSnapshot> {
    let config_path = base_path.join("guiConfigs").join("guiNConfig.json");

    let content = read_valid_config_string_for_observation(&config_path)?;

    let json: Value = serde_json::from_str(&content)
        .with_context(|| format!("Failed to parse config JSON: {}", config_path.display()))?;

    let enable_tun = extract_enable_tun(&json);

    let mut profiles = extract_profiles_from_json(&json);
    if profiles.is_empty() {
        profiles = read_profiles_from_db(base_path).unwrap_or_default();
    }

    let active_profile_name = extract_active_profile_name(&json, &profiles);

    Ok(ConfigSnapshot {
        enable_tun,
        active_profile_name,
        profiles,
    })
}

pub fn set_active_profile(base_path: &Path, profile_id: &str) -> Result<()> {
    let config_path = base_path.join("guiConfigs").join("guiNConfig.json");

    let _write_guard = CONFIG_WRITE_LOCK
        .lock()
        .map_err(|_| anyhow::anyhow!("v2rayN config write lock is poisoned"))?;
    let content = read_primary_config_string_for_update(&config_path)?;

    let mut json: Value = serde_json::from_str(&content)
        .with_context(|| format!("Failed to parse config JSON: {}", config_path.display()))?;

    let mut profiles = extract_profiles_from_json(&json);
    if profiles.is_empty() {
        profiles = read_profiles_from_db(base_path)?;
    }

    let target = profiles
        .iter()
        .find(|item| item.id == profile_id)
        .ok_or_else(|| anyhow::anyhow!("Profile not found: {profile_id}"))?;

    let mut selector_changed = set_first_existing_string_key(
        &mut json,
        &[
            "IndexId",
            "indexId",
            "SubIndexId",
            "subIndexId",
            "selectedProfileId",
            "selectedServerId",
        ],
        &target.id,
    );
    let _ = set_first_existing_string_key(
        &mut json,
        &["activeProfileName", "activeServerName", "currentProfile"],
        &target.name,
    );

    if !selector_changed {
        if let Some(root) = json.as_object_mut() {
            root.insert("IndexId".to_owned(), Value::String(target.id.clone()));
            selector_changed = true;
        }
    }

    if !selector_changed {
        return Err(anyhow::anyhow!(
            "Could not locate mutable profile selector fields in config"
        ));
    }

    let serialized = serde_json::to_string_pretty(&json)
        .with_context(|| format!("Failed to serialize config JSON: {}", config_path.display()))?;

    replace_config_if_unchanged(&config_path, &content, serialized.as_bytes())
        .with_context(|| format!("Failed to write config: {}", config_path.display()))?;

    Ok(())
}

pub fn toggle_tun_mode(base_path: &Path) -> Result<bool> {
    let config_path = base_path.join("guiConfigs").join("guiNConfig.json");

    let _write_guard = CONFIG_WRITE_LOCK
        .lock()
        .map_err(|_| anyhow::anyhow!("v2rayN config write lock is poisoned"))?;
    let content = read_primary_config_string_for_update(&config_path)?;

    let mut json: Value = serde_json::from_str(&content)
        .with_context(|| format!("Failed to parse config JSON: {}", config_path.display()))?;

    let current = extract_enable_tun(&json).unwrap_or(false);
    let next = !current;

    let mut changed = false;

    if let Some(root) = json.as_object_mut() {
        if let Some(tun_item) = root.get_mut("TunModeItem") {
            if let Some(tun_map) = tun_item.as_object_mut() {
                tun_map.insert("EnableTun".to_owned(), Value::Bool(next));
                changed = true;
            }
        }
    }

    if !changed {
        changed =
            set_first_existing_bool_key(&mut json, &["EnableTun", "enableTun", "tunEnabled"], next);
    }

    if !changed {
        if let Some(root) = json.as_object_mut() {
            root.insert(
                "TunModeItem".to_owned(),
                serde_json::json!({
                    "EnableTun": next,
                    "AutoRoute": true,
                    "StrictRoute": true,
                    "Stack": "gvisor",
                    "Mtu": 9000,
                    "EnableExInbound": false,
                    "EnableIPv6Address": false
                }),
            );
            changed = true;
        }
    }

    if !changed {
        return Err(anyhow::anyhow!("Could not toggle EnableTun in config"));
    }

    let serialized = serde_json::to_string_pretty(&json)
        .with_context(|| format!("Failed to serialize config JSON: {}", config_path.display()))?;

    replace_config_if_unchanged(&config_path, &content, serialized.as_bytes())
        .with_context(|| format!("Failed to write config: {}", config_path.display()))?;

    Ok(next)
}

fn read_valid_config_string_for_observation(config_path: &Path) -> Result<String> {
    let primary_result = fs::read_to_string(config_path);
    if let Ok(content) = &primary_result {
        if is_valid_config(content) {
            return Ok(content.clone());
        }
    }

    let primary_problem = match &primary_result {
        Ok(_) => format!(
            "Primary config failed validation: {}",
            config_path.display()
        ),
        Err(error) => format!(
            "Failed to read primary config {}: {error}",
            config_path.display()
        ),
    };
    let backup = config_backup_path(config_path);
    let backup_content = fs::read_to_string(&backup).with_context(|| {
        format!(
            "{primary_problem}; failed to read backup {}",
            backup.display()
        )
    })?;
    if !is_valid_config(&backup_content) {
        return Err(anyhow::anyhow!(
            "{primary_problem}; backup failed validation: {}",
            backup.display()
        ));
    }

    tracing::warn!(
        primary = %config_path.display(),
        backup = %backup.display(),
        "using valid v2rayN config backup for observation without modifying the primary file"
    );
    Ok(backup_content)
}

fn read_primary_config_string_for_update(config_path: &Path) -> Result<String> {
    file_store::recover_backup_if_missing(config_path)?;
    let content = fs::read_to_string(config_path).with_context(|| {
        format!(
            "Failed to read config for update: {}",
            config_path.display()
        )
    })?;
    if !is_valid_config(&content) {
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

fn is_valid_config(content: &str) -> bool {
    serde_json::from_str::<Value>(content).is_ok_and(|value| value.is_object())
}

fn config_backup_path(path: &Path) -> PathBuf {
    let mut value = path.as_os_str().to_os_string();
    value.push(".bak");
    PathBuf::from(value)
}

fn read_profiles_from_db(base_path: &Path) -> Result<Vec<ProfileSummary>> {
    let db_path = base_path.join("guiConfigs").join("guiNDB.db");
    if !db_path.exists() {
        return Ok(Vec::new());
    }

    let connection = Connection::open(db_path)?;
    let mut statement = connection.prepare(
        "SELECT IndexId, COALESCE(NULLIF(TRIM(Remarks), ''), 'Unnamed profile') AS Remarks FROM ProfileItem ORDER BY rowid",
    )?;

    let rows = statement.query_map([], |row| {
        let id: String = row.get(0)?;
        let name: String = row.get(1)?;
        Ok(ProfileSummary { id, name })
    })?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }

    Ok(result)
}

fn is_profile_collection_key(key: &str) -> bool {
    PROFILE_COLLECTION_KEYS.contains(&key)
}

fn set_first_existing_string_key(value: &mut Value, keys: &[&str], new_value: &str) -> bool {
    let Value::Object(map) = value else {
        return false;
    };

    for key in keys {
        if map.contains_key(*key) {
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

fn set_first_existing_bool_key(value: &mut Value, keys: &[&str], new_value: bool) -> bool {
    let Value::Object(map) = value else {
        return false;
    };

    for key in keys {
        if map.contains_key(*key) {
            map.insert((*key).to_owned(), Value::Bool(new_value));
            return true;
        }
    }

    for (key, child) in map.iter_mut() {
        if is_profile_collection_key(key) || !child.is_object() {
            continue;
        }

        if set_first_existing_bool_key(child, keys, new_value) {
            return true;
        }
    }

    false
}

fn extract_enable_tun(json: &Value) -> Option<bool> {
    if let Some(Value::Object(map)) = find_value_by_key(json, "TunModeItem") {
        if let Some(Value::Bool(flag)) = map.get("EnableTun") {
            return Some(*flag);
        }
        if let Some(Value::Bool(flag)) = map.get("enableTun") {
            return Some(*flag);
        }
    }

    find_bool_by_keys(json, &["EnableTun", "enableTun", "tunEnabled"])
}

fn find_bool_by_keys(value: &Value, keys: &[&str]) -> Option<bool> {
    let Value::Object(map) = value else {
        return None;
    };

    for key in keys {
        if let Some(Value::Bool(flag)) = map.get(*key) {
            return Some(*flag);
        }
    }

    for (key, child) in map {
        if is_profile_collection_key(key) || !child.is_object() {
            continue;
        }

        if let Some(flag) = find_bool_by_keys(child, keys) {
            return Some(flag);
        }
    }

    None
}

fn extract_active_profile_name(json: &Value, profiles: &[ProfileSummary]) -> Option<String> {
    let selected_id = find_string_by_keys(
        json,
        &[
            "IndexId",
            "indexId",
            "SubIndexId",
            "subIndexId",
            "selectedProfileId",
            "selectedServerId",
        ],
    )
    .or_else(|| find_number_by_keys(json, &["indexMain", "selectedIndex"]).map(|v| v.to_string()));

    if let Some(id) = selected_id {
        if let Some(found) = profiles.iter().find(|profile| profile.id == id) {
            return Some(found.name.clone());
        }
    }

    if let Some(name) = find_string_by_keys(
        json,
        &["activeProfileName", "activeServerName", "currentProfile"],
    ) {
        return Some(name);
    }

    None
}

fn extract_profiles_from_json(json: &Value) -> Vec<ProfileSummary> {
    let mut result = Vec::new();

    let list_keys = [
        "profiles",
        "servers",
        "vmess",
        "configs",
        "profileItem",
        "ProfileItem",
    ];
    for key in list_keys {
        if let Some(Value::Array(items)) = find_value_by_key(json, key) {
            for (index, item) in items.iter().enumerate() {
                if let Value::Object(map) = item {
                    let id = map
                        .get("id")
                        .or_else(|| map.get("IndexId"))
                        .or_else(|| map.get("indexId"))
                        .or_else(|| map.get("guid"))
                        .and_then(Value::as_str)
                        .map(ToOwned::to_owned)
                        .unwrap_or_else(|| index.to_string());

                    let name = map
                        .get("name")
                        .or_else(|| map.get("Remarks"))
                        .or_else(|| map.get("remarks"))
                        .or_else(|| map.get("profileName"))
                        .or_else(|| map.get("alias"))
                        .and_then(Value::as_str)
                        .map(ToOwned::to_owned)
                        .unwrap_or_else(|| format!("Profile {}", index + 1));

                    result.push(ProfileSummary { id, name });
                }
            }

            if !result.is_empty() {
                return result;
            }
        }
    }

    result
}

fn find_string_by_keys(value: &Value, keys: &[&str]) -> Option<String> {
    let Value::Object(map) = value else {
        return None;
    };

    for key in keys {
        if let Some(Value::String(text)) = map.get(*key) {
            return Some(text.to_owned());
        }
    }

    for (key, child) in map {
        if is_profile_collection_key(key) || !child.is_object() {
            continue;
        }

        if let Some(text) = find_string_by_keys(child, keys) {
            return Some(text);
        }
    }

    None
}

fn find_number_by_keys(value: &Value, keys: &[&str]) -> Option<i64> {
    let Value::Object(map) = value else {
        return None;
    };

    for key in keys {
        if let Some(number) = map.get(*key).and_then(Value::as_i64) {
            return Some(number);
        }
    }

    for (key, child) in map {
        if is_profile_collection_key(key) || !child.is_object() {
            continue;
        }

        if let Some(number) = find_number_by_keys(child, keys) {
            return Some(number);
        }
    }

    None
}

fn find_value_by_key<'a>(value: &'a Value, key: &str) -> Option<&'a Value> {
    match value {
        Value::Object(map) => {
            if let Some(found) = map.get(key) {
                return Some(found);
            }

            for child in map.values() {
                if let Some(found) = find_value_by_key(child, key) {
                    return Some(found);
                }
            }

            None
        }
        Value::Array(items) => items.iter().find_map(|item| find_value_by_key(item, key)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    fn profile(id: &str, name: &str) -> ProfileSummary {
        ProfileSummary {
            id: id.to_owned(),
            name: name.to_owned(),
        }
    }

    #[test]
    fn active_profile_prefers_selected_index_over_nested_remarks() {
        let json = serde_json::json!({
            "IndexId": "second",
            "ProfileItem": [
                { "IndexId": "first", "Remarks": "First profile" },
                { "IndexId": "second", "Remarks": "Second profile" }
            ]
        });
        let profiles = vec![
            profile("first", "First profile"),
            profile("second", "Second profile"),
        ];

        assert_eq!(
            extract_active_profile_name(&json, &profiles),
            Some("Second profile".to_owned())
        );
    }

    #[test]
    fn active_profile_is_unknown_when_only_profile_record_ids_exist() {
        let json = serde_json::json!({
            "ProfileItem": [
                { "IndexId": "first", "Remarks": "First profile" },
                { "IndexId": "second", "Remarks": "Second profile" }
            ]
        });
        let profiles = vec![
            profile("first", "First profile"),
            profile("second", "Second profile"),
        ];

        assert_eq!(extract_active_profile_name(&json, &profiles), None);
    }

    #[test]
    fn set_active_profile_does_not_rewrite_profile_remarks() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let base_path = std::env::temp_dir().join(format!("v2rayn-widget-config-test-{unique}"));
        let config_dir = base_path.join("guiConfigs");
        fs::create_dir_all(&config_dir).expect("create config dir");

        let config_path = config_dir.join("guiNConfig.json");
        fs::write(
            &config_path,
            serde_json::json!({
                "IndexId": "first",
                "ProfileItem": [
                    { "IndexId": "first", "Remarks": "First profile" },
                    { "IndexId": "second", "Remarks": "Second profile" }
                ]
            })
            .to_string(),
        )
        .expect("write config");

        set_active_profile(&base_path, "second").expect("set profile");
        let updated: Value =
            serde_json::from_str(&fs::read_to_string(&config_path).expect("read config"))
                .expect("parse config");

        assert_eq!(
            updated.get("IndexId").and_then(Value::as_str),
            Some("second")
        );
        assert_eq!(
            updated
                .get("ProfileItem")
                .and_then(Value::as_array)
                .and_then(|items| items.first())
                .and_then(|item| item.get("Remarks"))
                .and_then(Value::as_str),
            Some("First profile")
        );

        let _ = fs::remove_dir_all(base_path);
    }

    #[test]
    fn active_profile_ignores_numeric_selectors_inside_profile_records() {
        let json = serde_json::json!({
            "ProfileItem": [
                { "IndexId": "first", "Remarks": "First profile", "selectedIndex": 1 },
                { "IndexId": "second", "Remarks": "Second profile", "selectedIndex": 0 }
            ]
        });
        let profiles = vec![profile("0", "Zero profile"), profile("1", "One profile")];

        assert_eq!(extract_active_profile_name(&json, &profiles), None);
    }

    #[test]
    fn set_active_profile_adds_id_selector_when_only_name_selector_exists() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let base_path = std::env::temp_dir().join(format!(
            "v2rayn-widget-config-name-only-selector-test-{unique}"
        ));
        let config_dir = base_path.join("guiConfigs");
        fs::create_dir_all(&config_dir).expect("create config dir");

        let config_path = config_dir.join("guiNConfig.json");
        fs::write(
            &config_path,
            serde_json::json!({
                "activeProfileName": "First profile",
                "ProfileItem": [
                    { "IndexId": "first", "Remarks": "First profile" },
                    { "IndexId": "second", "Remarks": "Second profile" }
                ]
            })
            .to_string(),
        )
        .expect("write config");

        set_active_profile(&base_path, "second").expect("set profile");
        let updated: Value =
            serde_json::from_str(&fs::read_to_string(&config_path).expect("read config"))
                .expect("parse config");

        assert_eq!(
            updated.get("IndexId").and_then(Value::as_str),
            Some("second")
        );
        assert_eq!(
            updated.get("activeProfileName").and_then(Value::as_str),
            Some("Second profile")
        );

        let _ = fs::remove_dir_all(base_path);
    }

    #[test]
    fn set_active_profile_inserts_root_selector_without_mutating_profile_ids() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let base_path = std::env::temp_dir().join(format!(
            "v2rayn-widget-config-missing-selector-test-{unique}"
        ));
        let config_dir = base_path.join("guiConfigs");
        fs::create_dir_all(&config_dir).expect("create config dir");

        let config_path = config_dir.join("guiNConfig.json");
        fs::write(
            &config_path,
            serde_json::json!({
                "ProfileItem": [
                    { "IndexId": "first", "Remarks": "First profile" },
                    { "IndexId": "second", "Remarks": "Second profile" }
                ]
            })
            .to_string(),
        )
        .expect("write config");

        set_active_profile(&base_path, "second").expect("set profile");
        let updated: Value =
            serde_json::from_str(&fs::read_to_string(&config_path).expect("read config"))
                .expect("parse config");

        assert_eq!(
            updated.get("IndexId").and_then(Value::as_str),
            Some("second")
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
    fn read_config_uses_valid_backup_without_overwriting_corrupt_primary() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let base_path = std::env::temp_dir().join(format!(
            "v2rayn-widget-config-backup-observation-test-{unique}"
        ));
        let config_dir = base_path.join("guiConfigs");
        fs::create_dir_all(&config_dir).expect("create config dir");

        let config_path = config_dir.join("guiNConfig.json");
        fs::write(&config_path, "{broken").expect("write corrupt primary");
        fs::write(
            config_dir.join("guiNConfig.json.bak"),
            serde_json::json!({
                "TunModeItem": { "EnableTun": true },
                "IndexId": "first",
                "ProfileItem": [
                    { "IndexId": "first", "Remarks": "First profile" }
                ]
            })
            .to_string(),
        )
        .expect("write valid backup");

        let snapshot = read_config(&base_path).expect("read backup snapshot");
        assert_eq!(snapshot.enable_tun, Some(true));
        assert_eq!(
            snapshot.active_profile_name.as_deref(),
            Some("First profile")
        );
        assert_eq!(
            fs::read_to_string(&config_path).expect("read untouched primary"),
            "{broken"
        );

        let _ = fs::remove_dir_all(base_path);
    }

    #[test]
    fn config_mutation_rejects_corrupt_primary_even_with_valid_backup() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let base_path = std::env::temp_dir().join(format!(
            "v2rayn-widget-config-corrupt-mutation-test-{unique}"
        ));
        let config_dir = base_path.join("guiConfigs");
        fs::create_dir_all(&config_dir).expect("create config dir");

        let config_path = config_dir.join("guiNConfig.json");
        fs::write(&config_path, "{broken").expect("write corrupt primary");
        fs::write(
            config_dir.join("guiNConfig.json.bak"),
            serde_json::json!({ "TunModeItem": { "EnableTun": true } }).to_string(),
        )
        .expect("write valid backup");

        assert!(toggle_tun_mode(&base_path).is_err());
        assert_eq!(
            fs::read_to_string(&config_path).expect("read untouched primary"),
            "{broken"
        );

        let _ = fs::remove_dir_all(base_path);
    }

    #[test]
    fn guarded_update_rejects_concurrent_external_change() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let base_path = std::env::temp_dir().join(format!(
            "v2rayn-widget-config-concurrent-update-test-{unique}"
        ));
        let config_dir = base_path.join("guiConfigs");
        fs::create_dir_all(&config_dir).expect("create config dir");

        let config_path = config_dir.join("guiNConfig.json");
        let original = r#"{"TunModeItem":{"EnableTun":false}}"#;
        fs::write(&config_path, original).expect("write original config");
        fs::write(
            &config_path,
            r#"{"TunModeItem":{"EnableTun":true},"externalChange":true}"#,
        )
        .expect("write concurrent change");

        assert!(replace_config_if_unchanged(&config_path, original, b"{}").is_err());
        assert!(fs::read_to_string(&config_path)
            .expect("read retained external change")
            .contains("externalChange"));

        let _ = fs::remove_dir_all(base_path);
    }
}
