import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}
function write(path, content) {
  fs.writeFileSync(path, content.replaceAll("\r\n", "\n"), "utf8");
}
function replaceExact(path, before, after) {
  const source = read(path);
  const matches = source.split(before).length - 1;
  if (matches !== 1) throw new Error(`Expected exactly one match in ${path}, found ${matches}`);
  write(path, source.replace(before, after));
}

replaceExact(
  "src/tauri/src/commands/mod.rs",
  `fn merge_general_settings_payload(payload: AppSettings, current: &AppSettings) -> AppSettings {\n    let mut settings = normalize_settings(payload);\n\n    // This payload is owned by the general settings window. Preserve fields that\n    // are managed by client selection, Happ setup, or live window tracking so a\n    // stale draft cannot overwrite newer state from another window.\n    settings.selected_client = current.selected_client;\n    settings.happ_path = current.happ_path.clone();\n    settings.happ_allow_ui_automation = current.happ_allow_ui_automation;\n    settings.window_position = current.window_position.clone();\n    settings\n}\n`,
  `fn merge_general_settings_payload(payload: AppSettings, current: &AppSettings) -> AppSettings {\n    let mut settings = normalize_settings(payload);\n\n    // Full Settings saves own only fields that are intentionally draft-based.\n    // Live UI fields are persisted independently through apply_ui_settings and\n    // must be rebased from authoritative state so a stale full draft cannot roll\n    // back a newer patch or another window's settings event. Client selection,\n    // Happ setup and live window position are likewise owned elsewhere.\n    settings.selected_client = current.selected_client;\n    settings.language = current.language.clone();\n    settings.theme = current.theme.clone();\n    settings.always_on_top = current.always_on_top;\n    settings.time_format = current.time_format.clone();\n    settings.show_clock = current.show_clock;\n    settings.show_info_status = current.show_info_status;\n    settings.show_external_ip = current.show_external_ip;\n    settings.show_latency = current.show_latency;\n    settings.mock_mode_enabled = current.mock_mode_enabled;\n    settings.show_action_buttons = current.show_action_buttons;\n    settings.show_profile_selector = current.show_profile_selector;\n    settings.window_effect_enabled = current.window_effect_enabled;\n    settings.window_opacity_percent = current.window_opacity_percent;\n    settings.happ_path = current.happ_path.clone();\n    settings.happ_allow_ui_automation = current.happ_allow_ui_automation;\n    settings.window_position = current.window_position.clone();\n    settings\n}\n`,
);

replaceExact(
  "src/tauri/src/commands/mod.rs",
  `    #[test]\n    fn profile_name_match_requires_exact_normalized_name() {\n`,
  `    #[test]\n    fn general_settings_payload_rebases_live_ui_fields_and_applies_draft_fields() {\n        let current = AppSettings {\n            language: "ru".to_owned(),\n            theme: crate::models::settings::ThemeMode::Light,\n            always_on_top: true,\n            time_format: crate::models::settings::TimeFormat::H12,\n            show_clock: false,\n            show_info_status: false,\n            show_external_ip: false,\n            show_latency: false,\n            mock_mode_enabled: true,\n            show_action_buttons: false,\n            show_profile_selector: false,\n            window_effect_enabled: false,\n            window_opacity_percent: 61,\n            autostart_with_windows: false,\n            poll_interval_sec: 10,\n            ..AppSettings::default()\n        };\n        let stale_payload = AppSettings {\n            language: "en".to_owned(),\n            theme: crate::models::settings::ThemeMode::Dark,\n            always_on_top: false,\n            time_format: crate::models::settings::TimeFormat::H24,\n            show_clock: true,\n            show_info_status: true,\n            show_external_ip: true,\n            show_latency: true,\n            mock_mode_enabled: false,\n            show_action_buttons: true,\n            show_profile_selector: true,\n            window_effect_enabled: true,\n            window_opacity_percent: 92,\n            autostart_with_windows: true,\n            poll_interval_sec: 45,\n            ..AppSettings::default()\n        };\n\n        let merged = merge_general_settings_payload(stale_payload, &current);\n\n        assert_eq!(merged.language, current.language);\n        assert_eq!(merged.theme, current.theme);\n        assert_eq!(merged.always_on_top, current.always_on_top);\n        assert_eq!(merged.time_format, current.time_format);\n        assert_eq!(merged.show_clock, current.show_clock);\n        assert_eq!(merged.show_info_status, current.show_info_status);\n        assert_eq!(merged.show_external_ip, current.show_external_ip);\n        assert_eq!(merged.show_latency, current.show_latency);\n        assert_eq!(merged.mock_mode_enabled, current.mock_mode_enabled);\n        assert_eq!(merged.show_action_buttons, current.show_action_buttons);\n        assert_eq!(merged.show_profile_selector, current.show_profile_selector);\n        assert_eq!(merged.window_effect_enabled, current.window_effect_enabled);\n        assert_eq!(merged.window_opacity_percent, current.window_opacity_percent);\n        assert!(merged.autostart_with_windows);\n        assert_eq!(merged.poll_interval_sec, 45);\n    }\n\n    #[test]\n    fn profile_name_match_requires_exact_normalized_name() {\n`,
);

replaceExact(
  "docs/architecture.md",
  "- serialize the full Settings save behind pending live UI patches so an older patch cannot roll back a completed save;\n",
  "- serialize the full Settings save behind complete pending live UI workflows and rebase its live fields from authoritative backend state so neither an older patch nor a stale draft can roll back newer settings;\n",
);

replaceExact(
  "project-tracking/tasks/0032-auxiliary-settings-consistency.md",
  "4. Settings, Happ Setup and Debug Tools could accept a newer `settings-updated` event while their initial `getSettings()` request was pending, then overwrite it with the late stale response.\n",
  "4. Settings, Happ Setup and Debug Tools could accept a newer `settings-updated` event while their initial `getSettings()` request was pending, then overwrite it with the late stale response.\n5. Backend `update_settings` still accepted live UI fields from the full draft payload, so another window's newer language/theme/visibility update could be rolled back even when frontend request ordering was correct.\n",
);

replaceExact(
  "project-tracking/tasks/0032-auxiliary-settings-consistency.md",
  "- [x] Settings controls and close action are disabled while a full save is in progress.\n",
  "- [x] Settings controls and close action are disabled while a full save is in progress.\n- [x] Backend full-save merge preserves authoritative live UI fields while applying draft-owned fields.\n",
);

replaceExact(
  "project-tracking/reports/0032-auxiliary-settings-consistency-report.md",
  "4. **Stale initialization could beat a newer event.** Settings, Happ Setup and Debug Tools had no request revision guard around their initial settings fetch, so a late old response could overwrite a newer `settings-updated` event.\n",
  "4. **Stale initialization could beat a newer event.** Settings, Happ Setup and Debug Tools had no request revision guard around their initial settings fetch, so a late old response could overwrite a newer `settings-updated` event.\n5. **Backend ownership still allowed stale live-field rollback.** The full-save merge preserved adapter/window fields but still copied live UI fields from the draft payload instead of authoritative backend state.\n",
);

replaceExact(
  "project-tracking/reports/0032-auxiliary-settings-consistency-report.md",
  "- added settings-event revision guards to all three affected initial loads;\n",
  "- added settings-event revision guards to all three affected initial loads;\n- rebased every live UI field from authoritative backend state during full-save merge while retaining draft-owned general/v2rayN fields;\n- added a Rust ownership regression test for stale live fields versus fresh draft fields;\n",
);
