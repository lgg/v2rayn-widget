use std::collections::BTreeSet;

use serde_json::Value;

fn string_set(values: &Value) -> BTreeSet<String> {
    values
        .as_array()
        .expect("JSON array")
        .iter()
        .map(|value| value.as_str().expect("string entry").to_owned())
        .collect()
}

#[test]
fn tauri_config_registers_every_local_react_surface() {
    let config: Value = serde_json::from_str(include_str!("../tauri.conf.json"))
        .expect("valid Tauri configuration");
    let labels = config["app"]["windows"]
        .as_array()
        .expect("window configuration array")
        .iter()
        .map(|window| window["label"].as_str().expect("window label").to_owned())
        .collect::<BTreeSet<_>>();

    assert_eq!(
        labels,
        ["debug", "happ-setup", "main", "settings"]
            .into_iter()
            .map(str::to_owned)
            .collect(),
    );
}

#[test]
fn remote_diagnostics_webview_has_no_default_ipc_capability() {
    let capability: Value = serde_json::from_str(include_str!("../capabilities/default.json"))
        .expect("valid default capability");
    let windows = string_set(&capability["windows"]);

    assert_eq!(
        windows,
        ["debug", "happ-setup", "main", "settings"]
            .into_iter()
            .map(str::to_owned)
            .collect(),
    );
    assert!(!windows.contains("diagnostics"));
    assert!(capability.get("remote").is_none());
}
