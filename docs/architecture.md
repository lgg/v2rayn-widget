# Architecture

## System overview

Tauri desktop app with four responsibility layers:

- frontend (`src/frontend`) - shared widget UI, i18n, UX state and capability-gated controls;
- application commands (`src/tauri/src/client_commands.rs`) - generic selected-client dispatch;
- client adapters (`src/tauri/src/adapters`) - client descriptors, capabilities and client-specific behavior;
- shared backend services (`src/tauri/src/services`, `src/tauri/src/utils`) - health checks, persistence, window behavior and legacy v2rayN integration services.

The project uses compile-time registered adapters. Runtime DLL/plugin loading is not part of the current design.

## Adapter boundary

`ProxyClientAdapter` is the common registration trait. Every supported client must provide:

- a stable `ProxyClientId`;
- a `ClientDescriptor`;
- explicit `ClientCapabilities`.

Registered adapters:

- v2rayN;
- Happ.

The descriptor is the source of truth for frontend capability gating. The frontend must not infer supported operations only from the selected client name.

Capability states:

- `supported`;
- `experimental`;
- `unsupported`;
- `research_required`.

Unsupported actions are protected twice:

1. the frontend hides or disables the action;
2. the backend rejects the generic command if it is invoked anyway.

## Compatibility strategy

The application is migrating incrementally from a v2rayN-specific contract.

During the migration:

- `selected_client` defaults to `v2rayn` when loading old settings;
- legacy v2rayN Tauri commands remain registered;
- compatibility status fields such as `tun_enabled` and `active_profile_name` remain in `DashboardStatus`;
- existing v2rayN debug tools remain v2rayN-specific;
- new clients use generic commands and capability descriptors.

Future work should add generic `transport_mode` and `active_item_name` fields before removing compatibility aliases.

## Frontend

Responsibilities:

- render the compact widget;
- display and persist selected client through backend commands;
- render settings and debug windows;
- apply theme and visual effect settings;
- run the polling timer;
- show transient notices;
- clear stale status/items when switching clients;
- show profile/server controls only when adapter capabilities allow them;
- disable connection control when the selected adapter cannot safely provide it;
- open an optional diagnostics site in a separate WebView.

Key files:

- `src/frontend/src/app/App.tsx`
- `src/frontend/src/app/SettingsWindow.tsx`
- `src/frontend/src/app/DebugWindow.tsx`
- `src/frontend/src/components/client-selector.tsx`
- `src/frontend/src/components/info-panel.tsx`
- `src/frontend/src/features/dashboard-store.ts`
- `src/frontend/src/lib/api.ts`
- `src/frontend/src/lib/types.ts`

## Generic application commands

Defined in `src/tauri/src/client_commands.rs`:

- `get_client_catalog`
- `get_selected_client`
- `select_client`
- `refresh_selected_client`
- `refresh_selected_client_background`
- `refresh_selected_client_startup`
- `refresh_selected_client_post_route`
- `toggle_selected_client`
- `list_selected_client_items`
- `select_client_item`
- `open_selected_client`

The tray refresh/open actions use the generic command path.

## v2rayN adapter

The v2rayN adapter currently delegates to the proven legacy command/service implementation while presenting it through the generic registry.

Responsibilities and signals:

- resolve v2rayN installation path;
- read `guiNConfig.json`;
- read profiles from `guiNDB.db` fallback;
- read latest log;
- monitor v2rayN and core processes;
- run optional health checks;
- resolve combined connection status;
- toggle Enable TUN through UI Automation;
- use config mutation plus reload/restart fallback when enabled;
- list profiles;
- experimentally select the active profile;
- open/restart v2rayN;
- collect privilege/UIPI diagnostics.

Capability limitations:

- generic transport-mode reporting: unsupported;
- subscription list: unsupported;
- subscription switch: unsupported;
- subscription refresh/update: unsupported;
- subscription add/remove/manage: unsupported.

Profile selection is not subscription selection.

## Happ adapter

The initial Happ adapter is read-only and conservative.

Implemented:

- detect known process names;
- obtain executable path from a running process;
- inspect common Windows installation locations;
- use optional persisted `happ_path` when present;
- open the detected executable;
- run generic external IP and latency checks;
- report `Unknown` when Happ is running without a reliable internal connection-state signal;
- report `Disconnected` when the Happ process is absent.

Not implemented:

- public/validated CLI or daemon IPC;
- reliable connection-state reading;
- connect/disconnect;
- Proxy/TUN/Mixed transport mode;
- server/profile enumeration and selection;
- restart/reload;
- subscriptions;
- settings-window editor for `happ_path`.

The adapter must not infer `Connected` from process existence alone.

## Shared data models

### ProxyClientId

- `v2rayn`
- `happ`

### ClientDescriptor

- `id`
- `display_name`
- `maturity`
- `status_note`
- `capabilities`

### ClientCapabilities

- `detect_application`
- `read_process_state`
- `read_connection_state`
- `open_application`
- `toggle_connection`
- `list_items`
- `select_item`
- `restart_application`
- `read_transport_mode`
- `list_subscriptions`
- `switch_subscription`
- `refresh_subscription`
- `manage_subscriptions`

### DashboardStatus

Current compatibility model:

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

Adapter-related fields:

- `selected_client`
- `v2rayn_path_mode`
- `v2rayn_path`
- `happ_path`

Shared fields include language, theme, polling, window, diagnostics and health-check settings.

## Status refresh flow

1. frontend invokes a selected-client refresh command;
2. application layer reads `selected_client` from state;
3. command dispatches to the client-specific implementation;
4. adapter gathers its safe status signals;
5. shared network diagnostics run when enabled;
6. state is updated;
7. frontend renders only controls allowed by the selected descriptor.

### v2rayN refresh

1. resolve v2rayN path;
2. read config, profiles, logs and process state;
3. run optional network probes;
4. combine signals in the existing status resolver.

### Happ refresh

1. inspect Happ process state;
2. run optional network probes;
3. return `Unknown` while running or `Disconnected` while absent;
4. do not claim a connected VPN route without a validated Happ-specific signal.

## Connection action flow

### v2rayN

1. generic command dispatches to v2rayN adapter;
2. attempt UI Automation for Enable TUN;
3. if needed and allowed, toggle config;
4. attempt UI reload;
5. restart the intended v2rayN process only when reload cannot apply the change;
6. refresh status.

### Happ

The generic toggle command returns an explicit research-required error. The frontend disables the button based on capabilities.

## Legacy command API

Legacy commands remain registered for compatibility and v2rayN debug tooling:

- `get_status`
- `refresh_status`
- `refresh_status_post_route`
- `refresh_status_background`
- `refresh_status_startup`
- `toggle_tun_via_ui`
- `set_active_profile`
- `open_v2rayn`
- `restart_v2rayn`
- `detect_v2rayn_path`
- `validate_v2rayn_path`
- `list_profiles`
- v2rayN UI/config debug commands
- shared settings/window/locale commands.

They should be removed only after all frontend/debug consumers migrate and a dedicated compatibility removal task is completed.

## Build and release flows

- `.github/workflows/windows-quality.yml` validates frontend and Rust on Windows.
- `scripts/build-portable.ps1` runs frontend tests/build, Rust tests/build and copies the release executable to `dist/portable/`.
- `scripts/build-installer.ps1` runs frontend tests, prepares isolated Rust and invokes the Tauri NSIS flow.
- portable remains the primary artifact until installer and multi-client behavior are validated on target machines.
