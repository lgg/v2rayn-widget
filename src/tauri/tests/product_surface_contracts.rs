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

fn frontend_invoke_commands(source: &str) -> Vec<String> {
    source
        .lines()
        .filter_map(|line| {
            let invoke = line.find("invoke(").or_else(|| line.find("invoke<"))?;
            let after_invoke = &line[invoke..];
            let quote_start = after_invoke.find('"')? + 1;
            let after_start = &after_invoke[quote_start..];
            let quote_end = after_start.find('"')?;
            Some(after_start[..quote_end].to_owned())
        })
        .collect()
}

fn registered_tauri_commands(source: &str) -> Vec<String> {
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

fn unique_commands(commands: &[String]) -> BTreeSet<String> {
    commands.iter().cloned().collect()
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
    let frontend_unique = unique_commands(&frontend);
    let registered_unique = unique_commands(&registered);

    assert_eq!(
        frontend.len(),
        frontend_unique.len(),
        "frontend API contains a duplicate Tauri command wrapper"
    );
    assert_eq!(
        registered.len(),
        registered_unique.len(),
        "Tauri generate_handler contains a duplicate command registration"
    );
    assert_eq!(frontend_unique, registered_unique);
}

#[test]
fn auxiliary_react_surfaces_never_hide_their_native_window_directly() {
    for (name, source) in [
        (
            "Settings",
            include_str!("../../frontend/src/app/SettingsWindow.tsx"),
        ),
        (
            "Debug",
            include_str!("../../frontend/src/app/DebugWindow.tsx"),
        ),
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
fn preferred_window_geometry_matches_native_declarations() {
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

    for (label, expected_width, expected_height) in [
        ("settings", 430_u64, 760_u64),
        ("happ-setup", 500_u64, 720_u64),
    ] {
        let window = windows
            .iter()
            .find(|window| window["label"].as_str() == Some(label))
            .expect("configured fixed window");
        assert_eq!(window["width"].as_u64(), Some(expected_width));
        assert_eq!(window["height"].as_u64(), Some(expected_height));
        assert_eq!(window["resizable"].as_bool(), Some(false));
    }

    let geometry = include_str!("../src/utils/window_position.rs");
    assert!(geometry.contains("MAIN_MIN_INNER_LOGICAL_SIZE: (u32, u32) = (360, 270)"));
    assert!(geometry.contains("DEBUG_MIN_INNER_LOGICAL_SIZE: (u32, u32) = (460, 420)"));
    assert!(geometry.contains("DIAGNOSTICS_MIN_INNER_LOGICAL_SIZE: (u32, u32) = (760, 520)"));
    assert!(geometry.contains("SETTINGS_PREFERRED_INNER_LOGICAL_SIZE: (u32, u32) = (430, 760)"));
    assert!(geometry.contains("HAPP_SETUP_PREFERRED_INNER_LOGICAL_SIZE: (u32, u32) = (500, 720)"));
    assert!(geometry.contains(".to_physical(scale_factor)"));

    let commands = include_str!("../src/commands/mod.rs");
    assert!(commands.contains(".min_inner_size(760.0, 520.0)"));
}

#[test]
fn happ_toggle_confirms_before_restoring_the_original_minimized_state() {
    let adapter = include_str!("../src/adapters/happ.rs");
    let confirmation = adapter
        .find("let confirmation: Result<DashboardStatus, String>")
        .expect("Happ toggle confirmation phase");
    let restoration = adapter
        .find("happ_ui::restore_window_after_toggle")
        .expect("Happ minimized-state restoration");

    assert!(confirmation < restoration);
    assert!(adapter.contains("refresh(settings, false, false, false)"));

    let controller = include_str!("../src/services/happ_ui.rs");
    assert!(controller.contains("restore_minimized: was_minimized"));
    assert!(controller.contains("scan_controls(hwnd, true)"));
    assert!(controller.contains("let require_onscreen = !unsafe { IsIconic(hwnd).as_bool() }"));
}
