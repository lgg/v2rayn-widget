use std::{fs, path::Path};

use anyhow::{Context, Result};
use rusqlite::Connection;
use serde_json::Value;

use crate::models::profile::ProfileSummary;

#[derive(Debug, Clone, Default)]
pub struct ConfigSnapshot {
    pub enable_tun: Option<bool>,
    pub active_profile_name: Option<String>,
    pub profiles: Vec<ProfileSummary>,
}

pub fn read_config(base_path: &Path) -> Result<ConfigSnapshot> {
    let config_path = base_path.join("guiConfigs").join("guiNConfig.json");

    let content = fs::read_to_string(&config_path)
        .with_context(|| format!("Failed to read config: {}", config_path.display()))?;

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

    let content = fs::read_to_string(&config_path)
        .with_context(|| format!("Failed to read config: {}", config_path.display()))?;

    let backup_path = base_path.join("guiConfigs").join("guiNConfig.json.bak");
    let _ = fs::write(&backup_path, &content);

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

    let mut changed = false;
    changed |= set_first_existing_string_key(
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
    changed |= set_first_existing_string_key(
        &mut json,
        &["activeProfileName", "activeServerName", "currentProfile"],
        &target.name,
    );

    if !changed {
        if let Some(root) = json.as_object_mut() {
            root.insert("IndexId".to_owned(), Value::String(target.id.clone()));
            changed = true;
        }
    }

    if !changed {
        return Err(anyhow::anyhow!(
            "Could not locate mutable profile selector fields in config"
        ));
    }

    let serialized = serde_json::to_string_pretty(&json)
        .with_context(|| format!("Failed to serialize config JSON: {}", config_path.display()))?;

    fs::write(&config_path, serialized)
        .with_context(|| format!("Failed to write config: {}", config_path.display()))?;

    Ok(())
}

pub fn toggle_tun_mode(base_path: &Path) -> Result<bool> {
    let config_path = base_path.join("guiConfigs").join("guiNConfig.json");

    let content = fs::read_to_string(&config_path)
        .with_context(|| format!("Failed to read config: {}", config_path.display()))?;

    let backup_path = base_path.join("guiConfigs").join("guiNConfig.json.bak");
    let _ = fs::write(&backup_path, &content);

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

    fs::write(&config_path, serialized)
        .with_context(|| format!("Failed to write config: {}", config_path.display()))?;

    Ok(next)
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

fn set_first_existing_string_key(value: &mut Value, keys: &[&str], new_value: &str) -> bool {
    match value {
        Value::Object(map) => {
            for key in keys {
                if map.contains_key(*key) {
                    map.insert((*key).to_owned(), Value::String(new_value.to_owned()));
                    return true;
                }
            }

            for child in map.values_mut() {
                if set_first_existing_string_key(child, keys, new_value) {
                    return true;
                }
            }

            false
        }
        Value::Array(items) => {
            for child in items {
                if set_first_existing_string_key(child, keys, new_value) {
                    return true;
                }
            }

            false
        }
        _ => false,
    }
}

fn set_first_existing_bool_key(value: &mut Value, keys: &[&str], new_value: bool) -> bool {
    match value {
        Value::Object(map) => {
            for key in keys {
                if map.contains_key(*key) {
                    map.insert((*key).to_owned(), Value::Bool(new_value));
                    return true;
                }
            }

            for child in map.values_mut() {
                if set_first_existing_bool_key(child, keys, new_value) {
                    return true;
                }
            }

            false
        }
        Value::Array(items) => {
            for child in items {
                if set_first_existing_bool_key(child, keys, new_value) {
                    return true;
                }
            }

            false
        }
        _ => false,
    }
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
    match value {
        Value::Object(map) => {
            for key in keys {
                if let Some(Value::Bool(flag)) = map.get(*key) {
                    return Some(*flag);
                }
            }

            for child in map.values() {
                if let Some(flag) = find_bool_by_keys(child, keys) {
                    return Some(flag);
                }
            }

            None
        }
        Value::Array(items) => items.iter().find_map(|item| find_bool_by_keys(item, keys)),
        _ => None,
    }
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

    profiles.first().map(|profile| profile.name.clone())
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
    for key in keys {
        if let Some(found) = find_value_by_key(value, key) {
            if let Some(text) = found.as_str() {
                return Some(text.to_owned());
            }
        }
    }

    None
}

fn find_number_by_keys(value: &Value, keys: &[&str]) -> Option<i64> {
    for key in keys {
        if let Some(found) = find_value_by_key(value, key) {
            if let Some(number) = found.as_i64() {
                return Some(number);
            }
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
    use std::time::{SystemTime, UNIX_EPOCH};

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
}
