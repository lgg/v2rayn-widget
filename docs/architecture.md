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
- `src/frontend/src/components/settings-panel.tsx`
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
- `refresh_status_background`
- `refresh_status_startup`
- `toggle_tun_via_ui`
- `set_active_profile`
- `open_v2rayn`
- `restart_v2rayn`
- `get_settings`
- `update_settings`
- `detect_v2rayn_path`
- `validate_v2rayn_path`
- `get_available_locales`
- `list_profiles`
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
- `poll_interval_sec`
- `time_format`
- `show_external_ip`
- `show_latency`
- `show_action_buttons`
- `show_profile_selector`
- `window_effect_enabled`
- `window_opacity_percent`
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
