# Architecture

## System overview

Tauri desktop app with split responsibilities:
- frontend (`src/frontend`): UI, i18n, UX state.
- backend (`src/tauri`): v2rayN integration, status resolution, automation, persistence.

## Frontend

Responsibilities:
- render compact widget,
- render settings overlay,
- apply themes and visual effect mode,
- run polling timer,
- show transient notices (toast/inline),
- handle profile selector and action buttons visibility.

Key files:
- `src/frontend/src/app/App.tsx`
- `src/frontend/src/app/SettingsWindow.tsx`
- `src/frontend/src/app/DebugWindow.tsx`
- `src/frontend/src/components/info-panel.tsx`
- `src/frontend/src/features/dashboard-store.ts`

## Backend

Responsibilities:
- read config (`guiNConfig.json`),
- read profile list (DB fallback `guiNDB.db`),
- read latest log,
- process monitor,
- health checks,
- resolve status model,
- toggle TUN (UI automation + fallback),
- persist app settings,
- apply window behavior (always-on-top, rounded region, opacity),
- apply autostart setting.

Key modules:
- `services/config_reader.rs`
- `services/log_reader.rs`
- `services/health_check.rs`
- `services/process_monitor.rs`
- `services/status_service.rs`
- `services/ui_controller.rs`
- `commands/mod.rs`
- `utils/settings_store.rs`
- `utils/window_visuals.rs`
- `utils/autostart.rs`

## Command API

- `get_status`
- `refresh_status`
- `refresh_status_post_route`
- `refresh_status_background`
- `refresh_status_startup`
- `toggle_tun_via_ui`
- `set_active_profile`
- `open_v2rayn`
- `restart_v2rayn`
- `get_settings`
- `update_settings`
- `apply_ui_settings`
- `open_settings_window`
- `open_debug_window`
- `run_ui_debug_probe`
- `debug_toggle_via_ui_only`
- `debug_click_reload_via_ui`
- `debug_select_profile_via_ui`
- `debug_capture_runtime_snapshot`
- `debug_toggle_via_config_only`
- `relaunch_widget_as_admin`
- `detect_v2rayn_path`
- `validate_v2rayn_path`
- `get_available_locales`
- `list_profiles`
- `close_window`
- `set_main_window_height`
- `exit_app`

## Data models

### DashboardStatus
- `status`
- `tun_enabled`
- `connection_state`
- `active_profile_name`
- `external_ip`
- `latency_ms`
- `last_error`
- `last_event`
- `updated_at`

### AppSettings
- `language`
- `theme`
- `always_on_top`
- `autostart_with_windows`
- `allow_restart_fallback`
- `poll_interval_sec`
- `time_format`
- `show_clock`
- `show_info_status`
- `show_external_ip`
- `show_latency`
- `mock_mode_enabled`
- `show_action_buttons`
- `show_profile_selector`
- `window_effect_enabled`
- `window_opacity_percent`
- `window_fix_mode`
- `latency_mode`
- `connectivity_endpoints`
- `ip_endpoints`
- `v2rayn_path_mode`
- `v2rayn_path`
- `window_position`

## Flow: status refresh

1. frontend requests refresh command.
2. backend resolves v2rayN path.
3. backend reads config + profiles + logs + process state.
4. backend runs optional health checks.
5. resolver combines signals into `DashboardStatus`.
6. frontend updates UI with minimal loading state changes.

## Flow: toggle

1. attempt UI automation for Enable TUN.
2. if fails, fallback to config toggle (`EnableTun`).
3. optionally restart v2rayN after fallback update.
4. refresh status and return updated model.
