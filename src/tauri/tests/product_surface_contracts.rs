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

fn frontend_invoke_commands(source: &str) -> BTreeSet<String> {
    source
        .lines()
        .filter_map(|line| {
            let invoke = line
                .find("invoke(")
                .or_else(|| line.find("invoke<"))?;
            let after_invoke = &line[invoke..];
            let quote_start = after_invoke.find('"')? + 1;
            let after_start = &after_invoke[quote_start..];
            let quote_end = after_start.find('"')?;
            Some(after_start[..quote_end].to_owned())
        })
        .collect()
}

fn registered_tauri_commands(source: &str) -> BTreeSet<String> {
    let handlers = source
        .split_once("tauri::generate_handler![")
        .expect("Tauri handler registration")
        .1
        .split_once("])")
        .expect("end of Tauri handler registration")
        .0;

    handlers
        .lines()
        .filter_map(|line| {
            let candidate = line.trim().trim_end_matches(',');
            candidate
                .rsplit_once("::")
                .map(|(_, command)| command.to_owned())
        })
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

#[test]
fn every_frontend_invoke_has_exactly_one_registered_tauri_command() {
    let frontend = frontend_invoke_commands(include_str!("../../frontend/src/lib/api.ts"));
    let registered = registered_tauri_commands(include_str!("../src/main.rs"));

    assert_eq!(frontend, registered);
}

#[test]
fn auxiliary_react_surfaces_never_hide_their_native_window_directly() {
    for (name, source) in [
        (
            "Settings",
            include_str!("../../frontend/src/app/SettingsWindow.tsx"),
        ),
        ("Debug", include_str!("../../frontend/src/app/DebugWindow.tsx")),
        (
            "Happ Setup",
            include_str!("../../frontend/src/app/HappSetupWindow.tsx"),
        ),
    ] {
        assert!(
            !source.contains(".hide()"),
            "{name} must route close through the safe Rust command"
        );
    }
}

#[test]
fn native_debug_close_is_forwarded_to_the_frontend_safe_close_path() {
    let main = include_str!("../src/main.rs");
    assert!(main.contains("window.emit(\"debug-close-requested\", ())"));
}

#[test]
fn preferred_window_minimums_match_native_declarations() {
    let config: Value = serde_json::from_str(include_str!("../tauri.conf.json"))
        .expect("valid Tauri configuration");
    let windows = config["app"]["windows"]
        .as_array()
        .expect("window configuration array");

    for (label, expected_width, expected_height) in
        [("main", 360_u64, 270_u64), ("debug", 460_u64, 420_u64)]
    {
        let window = windows
            .iter()
            .find(|window| window["label"].as_str() == Some(label))
            .expect("configured local window");
        assert_eq!(window["minWidth"].as_u64(), Some(expected_width));
        assert_eq!(window["minHeight"].as_u64(), Some(expected_height));
    }

    let geometry = include_str!("../src/utils/window_position.rs");
    assert!(geometry.contains("MAIN_MIN_INNER_SIZE: (u32, u32) = (360, 270)"));
    assert!(geometry.contains("DEBUG_MIN_INNER_SIZE: (u32, u32) = (460, 420)"));
    assert!(geometry.contains("DIAGNOSTICS_MIN_INNER_SIZE: (u32, u32) = (760, 520)"));

    let commands = include_str!("../src/commands/mod.rs");
    assert!(commands.contains(".min_inner_size(760.0, 520.0)"));
}
