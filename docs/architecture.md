# Architecture

## System overview

Tauri desktop application with four responsibility layers:

- frontend (`src/frontend`) — shared widget UI, i18n, capability gating, setup/debug windows and polling;
- application commands (`src/tauri/src/client_commands.rs`) — generic selected-adapter dispatch;
- client adapters (`src/tauri/src/adapters`) — client-specific operations, capabilities and diagnostics;
- backend services (`src/tauri/src/services`, `src/tauri/src/utils`) — health checks, persistence, window behavior and automation helpers.

Adapters are registered at compile time. Runtime DLL/plugin loading is not part of the design.

## Operational adapter boundary

`ProxyClientAdapter` is the common application contract. Each registered adapter provides:

- stable `ProxyClientId`;
- dynamic `ClientDescriptor` and `ClientCapabilities`;
- foreground/background/startup/post-route refresh;
- connection toggle;
- item list and selection;
- application open;
- `ClientDiagnostics`.

Registered adapters:

- `RegisteredAdapter::V2rayn`;
- `RegisteredAdapter::Happ`.

`client_commands.rs` resolves `selected_client` and calls the trait. It does not contain v2rayN/Happ operation branching. New clients are added by implementing the adapter contract and registering the enum variant.

Capability states:

- `supported`;
- `experimental`;
- `unsupported`;
- `research_required`.

Unsupported operations are protected twice:

1. frontend gating;
2. backend rejection.

## Compatibility strategy

The project migrated incrementally from a v2rayN-specific API:

- old settings default to `selected_client = v2rayn`;
- legacy v2rayN Tauri commands remain registered;
- `DashboardStatus.tun_enabled` and `active_profile_name` remain compatibility fields;
- v2rayN Debug Tools remain client-specific;
- new UI and tray operations use generic commands.

Compatibility APIs should be removed only in a separate reviewed cleanup task.

## Shared models

### ProxyClientId

- `v2rayn`
- `happ`

### ClientDescriptor

- `id`
- `display_name`
- `maturity`
- `status_note`
- `capabilities`

### ClientDiagnostics

- client/process/PID/executable;
- window detection/title;
- connection state;
- transport mode;
- control source;
- detected action and confidence;
- redacted UI nodes;
- adapter note.

### TransportMode

- `unknown`
- `proxy`
- `tun`
- `mixed`

### AppSettings adapter fields

- `selected_client`
- `v2rayn_path_mode`
- `v2rayn_path`
- `happ_path`
- `happ_allow_ui_automation`

`happ_allow_ui_automation` defaults to `false` through Serde migration defaults.

## Generic command flow

Generic commands:

- `get_client_catalog`
- `get_selected_client`
- `get_selected_client_diagnostics`
- `select_client`
- `refresh_selected_client*`
- `toggle_selected_client`
- `list_selected_client_items`
- `select_client_item`
- `open_selected_client`

Adapter-specific setup helpers remain allowed where the contract requires client-specific configuration, such as Happ path validation and the Happ diagnostics probe.

Status refresh:

1. frontend invokes a generic refresh;
2. command reads `selected_client`;
3. registry returns the operational adapter;
4. adapter gathers safe client-specific signals;
5. shared health checks run when enabled;
6. state is updated;
7. frontend renders controls based on descriptor capabilities and explicit opt-in settings.

## v2rayN adapter

The v2rayN adapter delegates to the proven existing services while exposing them through the generic contract.

Responsibilities:

- resolve installation path;
- read config, profile database and latest log;
- monitor v2rayN/core processes;
- run optional health checks;
- resolve combined status;
- toggle Enable TUN through Windows UI Automation;
- use config plus reload/restart fallback when enabled;
- list profiles;
- experimentally select the active profile;
- open/restart;
- collect privilege/UIPI diagnostics.

Explicitly unsupported:

- generic transport-mode reporting;
- subscription list/switch/refresh/update/add/remove/manage.

Profile selection is not subscription selection.

## Happ adapter

### Safe baseline

- detect known Happ process names and PID;
- detect executable from the process or common installation folders;
- validate optional manual executable path;
- open the application;
- run generic IP/latency diagnostics;
- report Disconnected while absent;
- report Unknown while running without a reliable Happ-specific signal;
- never infer Connected from process existence.

### Experimental control

Happ control is disabled by default and requires explicit consent in `HappSetupWindow`.

The controller in `services/happ_ui.rs`:

1. receives the detected Happ PID;
2. enumerates visible windows belonging only to that PID;
3. selects the best application window;
4. scans its UI Automation subtree;
5. accepts only explicit English/Russian Connect or Disconnect actions;
6. rejects Auto connect, Reconnect and connection-settings labels;
7. requires a high confidence score;
8. clicks through Invoke, Toggle, LegacyAccessible or native button fallback;
9. refreshes status after the action;
10. fails without clicking when identification is ambiguous.

Connection state is inferred from the visible action:

- visible Disconnect action → currently Connected;
- visible Connect action → currently Disconnected;
- no reliable action → Unknown.

Transport mode is reported experimentally only when the UI exposes an exact selected Proxy, TUN or Mixed item. Otherwise it remains Unknown.

The controller never writes Happ config, database or subscription files.

### Happ diagnostics window

`HappSetupWindow` provides:

- executable path detection/validation;
- explicit experimental-control opt-in;
- runtime probe;
- process/PID/path/window data;
- inferred state and transport;
- action label/confidence;
- expandable redacted UI Automation tree.

This is the target-machine compatibility mechanism for version-sensitive Happ UI changes.

## Frontend

Key responsibilities:

- render selected-client UX;
- persist selection through backend commands;
- clear stale status/items after switching;
- gate controls using capabilities;
- additionally require persisted Happ UIA consent before enabling connect;
- render Settings, Debug and Happ Setup windows;
- apply visual settings and polling;
- show transient errors and diagnostic information.

Key files:

- `src/frontend/src/app/App.tsx`
- `src/frontend/src/app/SettingsWindow.tsx`
- `src/frontend/src/app/DebugWindow.tsx`
- `src/frontend/src/app/HappSetupWindow.tsx`
- `src/frontend/src/components/client-selector.tsx`
- `src/frontend/src/features/dashboard-store.ts`
- `src/frontend/src/lib/api.ts`
- `src/frontend/src/lib/types.ts`

## Subscription boundary

Subscriptions are deliberately not represented as profiles or servers.

Current states:

- v2rayN subscription operations: `unsupported`;
- Happ subscription operations: `research_required`.

A separate future model must define list, active subscription, refresh, switch, add/remove and metadata only when a client exposes a safe control contract.

## Build and verification

`.github/workflows/windows-quality.yml`:

- installs frontend dependencies reproducibly with `npm ci`;
- rejects high-severity dependency advisories with `npm audit --audit-level=high`;
- runs frontend tests and the TypeScript/Vite production build;
- transfers the exact frontend `dist` artifact to the Rust job;
- verifies changed Rust formatting;
- runs Rust unit/regression tests;
- runs strict Clippy with warnings denied;
- runs `cargo check --locked`;
- performs `cargo build --release --locked`;
- verifies and uploads the produced portable executable as a one-day smoke artifact;
- preserves short-lived audit, test, build and release diagnostics.

Network diagnostics disable redirects and ambient proxy settings, resolve each configured HTTP(S) endpoint, reject the endpoint if any answer is non-public, and pin hostname requests to the exact validated `SocketAddr` set with `reqwest::ClientBuilder::resolve_to_addrs`. This removes the second unvalidated DNS lookup that could otherwise permit DNS rebinding. Literal or resolved loopback, private, link-local, CGNAT, benchmark, documentation, multicast, reserved, NAT64, Teredo and 6to4 addresses are rejected.

The Rust suite includes existing v2rayN resolver/config/log tests, exact profile-selection tests, network-target safety tests and pure Happ classifier tests. Runtime-specific Happ variation is handled through probe diagnostics and fail-closed behavior.
