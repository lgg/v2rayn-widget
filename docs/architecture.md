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

Every command string exported by `src/frontend/src/lib/api.ts` is contract-tested against the exact set registered in `tauri::generate_handler!`. A missing handler, stale compatibility registration or frontend typo fails the Rust integration suite.

## Active client context consistency

Client epoch and stale-result rejection describe the selected adapter's operational context, not every persisted setting in the application.

Active contexts:

- v2rayN — selected client, path mode/path and v2rayN mock mode;
- Happ — selected client, executable path and UI Automation consent.

Rules:

- selecting another client always invalidates the previous context;
- changing fields owned by an inactive adapter preserves the selected adapter's epoch, status and in-flight operations;
- appearance, tray, autostart, polling and diagnostics settings preserve the selected adapter's epoch/status;
- shared health-display and endpoint changes request an eventual refresh but do not cancel a control operation;
- an active non-mock v2rayN path change clears status from the previous installation;
- an active v2rayN mock transition uses the supplied mock/default status;
- active Happ path/consent changes keep the fail-closed status reset;
- Main's operational refresh key contains only active-adapter fields plus shared health-display fields.

The frontend and Rust backend both have permanent active/inactive context matrix tests. Backend state commit logic also ignores an accidentally supplied replacement status when no active context changed, preventing v2rayN mock status from leaking into active Happ state.

## v2rayN adapter

The v2rayN adapter delegates to the proven existing services while exposing them through the generic contract.

Responsibilities:

- resolve installation path;
- read config, profile database and latest log;
- keep observational config reads non-mutating while action confirmation uses only the valid primary file;
- reject backup recovery, unknown schema invention, field retyping and concurrent external config mutations;
- serialize v2rayN refresh/control operations and reject stale selected-client epochs;
- monitor v2rayN/core processes and retain every PID belonging to the configured installation;
- scope process, privilege and Windows UI Automation operations to the configured installation PID/window;
- run optional health checks;
- resolve combined status;
- toggle Enable TUN only through an explicit clickable UI action and confirm a real state transition;
- use idempotent explicit config state plus verified full restart fallback when enabled;
- list profiles;
- experimentally select the active profile;
- activate an existing configured instance without spawning a duplicate;
- open/restart from the configured installation directory;
- terminate every matched process and verify complete exit/startup before reporting success;
- collect privilege/UIPI diagnostics for the selected process.

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
8. waits for a unique high-confidence action after a cold process start;
9. restores a previously minimized window for one onscreen click;
10. keeps the window restored while confirming the expected state;
11. performs a fast local status refresh without blocking on network diagnostics;
12. restores the original minimized state after confirmation or failure;
13. fails without clicking when identification is ambiguous.

A read-only probe may classify an exact enabled action while the top-level Happ window itself is minimized. The click path still requires an enabled onscreen control, so hidden controls in a normal window are not promoted into actionable state.

Connection state is inferred from the reliable action:

- reliable Disconnect action → currently Connected;
- reliable Connect action → currently Disconnected;
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
- clear stale status/items after switching or changing the active adapter context;
- preserve status and in-flight operations when only an inactive adapter or general setting changes;
- gate controls using capabilities;
- additionally require persisted Happ UIA consent before enabling connect;
- render Settings, Debug and Happ Setup windows;
- bootstrap persisted language/theme/visual settings in every native React surface and subscribe auxiliary surfaces to later settings events;
- preserve Happ Setup path/consent drafts while applying external language and visual updates;
- serialize the full Settings save behind complete pending live UI workflows and rebase its live fields from authoritative backend state so neither an older patch nor a stale draft can roll back newer settings;
- dispose asynchronous Tauri event registrations safely;
- serialize live UI-setting writes and reject stale client operations;
- expose explicit bootstrap/load/probe failure states and draft-aware native close handling;
- keep Settings/Happ drafts intact when close fails or the application language changes;
- display an accessible localized global alert when an auxiliary close cannot complete safely;
- apply visual settings and polling;
- show transient errors and diagnostic information.

Key files:

- `src/frontend/src/app/App.tsx`
- `src/frontend/src/app/SettingsWindow.tsx`
- `src/frontend/src/app/DebugWindow.tsx`
- `src/frontend/src/app/HappSetupWindow.tsx`
- `src/frontend/src/components/client-selector.tsx`
- `src/frontend/src/components/window-close-failure-banner.tsx`
- `src/frontend/src/features/active-client-context.ts`
- `src/frontend/src/features/dashboard-store.ts`
- `src/frontend/src/lib/api.ts`
- `src/frontend/src/lib/types.ts`

## Native tray runtime

The tray menu is initialized from the persisted application language and retains live menu-item/tray handles so a successful language patch updates every label and tooltip immediately. Runtime language changes participate in the same apply/persist/rollback transaction as always-on-top and autostart.

Tray Refresh executes the selected adapter's backend refresh and emits a typed client-scoped status event to Main. Main ignores inactive-client events and compares backend timestamps so an older in-flight frontend response cannot overwrite a newer tray result. Refresh and Open Client failures emit typed operation errors and use the same visible notice/UIPI handling as equivalent Main actions.

## Window lifecycle and geometry

Main is the recovery surface for Settings, Debug and Happ Setup. Auxiliary React surfaces never call native `.hide()` directly.

Safe close sequence:

1. frontend invokes `close_window`;
2. Rust shows and unminimizes Main;
3. Main is fitted to the active monitor work area and focused;
4. only then is the auxiliary source hidden;
5. if any restoration step fails, the source remains visible and frontend receives a `false` result plus a localized alert.

Native Settings, Happ Setup and Debug title-bar close events are forwarded into their React surfaces so custom and native close paths share the same draft and failure behavior.

Work-area fitting uses monitor work areas rather than full monitor bounds, supports negative desktop coordinates and accounts for decorated frame size. Main, Debug and Diagnostics preferred native minimum inner sizes are capped when a small/RDP work area cannot contain them. When the window later moves to a larger monitor, the preferred minimum is restored before final outer-size and position clamping so the restored minimum cannot push the window off-screen.

## Subscription boundary

Subscriptions are deliberately not represented as profiles or servers.

Current states:

- v2rayN subscription operations: `unsupported`;
- Happ subscription operations: `research_required`.

A separate future model must define list, active subscription, refresh, switch, add/remove and metadata only when a client exposes a safe control contract.

## Build and verification

The permanent `Release Quality` workflow runs frontend and Rust jobs on the dedicated validation-only Windows runner selected by `[self-hosted, v2rayn-widget-ci]`.

It does not install, update or repair system toolchains and does not build or execute an NSIS installer. Required Node.js, npm, Rust/MSVC, rustfmt, Clippy, Visual Studio C++ tools, locked Tauri CLI and exact Tauri NSIS cache must already exist. Missing or mismatched prerequisites fail closed with manual-provisioning guidance.

Frontend job:

- verifies workflow/runner/no-provisioning/action-pinning/credential/cleanup contracts;
- restores dependencies into the checkout with `npm ci --ignore-scripts` and process-scoped cache/registry settings;
- rejects high-severity advisories with `npm audit --audit-level=high`;
- runs the complete frontend test suite and TypeScript/Vite production build;
- uploads the exact frontend distribution and diagnostics;
- removes generated dependencies, build output and process-scoped cache.

Rust job:

- consumes the exact frontend distribution artifact;
- validates pre-provisioned Rust/MSVC prerequisites;
- checks formatting for the complete Rust workspace;
- runs all Rust unit and integration tests;
- runs strict all-targets Clippy with warnings denied;
- runs strict release/no-default-features Clippy;
- executes `cargo check --locked`;
- performs a locked portable release smoke build;
- uploads the portable executable and Rust diagnostics;
- removes generated Rust/release workspaces.

The separate trusted `Build Release Assets` workflow is responsible for installer packaging. It validates and fingerprints the exact pre-provisioned NSIS cache, creates current-user assets without executing generated installers, and passes only checksum-verified allowlisted files to the isolated hosted publishing job.

Network diagnostics disable redirects and ambient proxy settings, resolve each configured HTTP(S) endpoint, reject the endpoint if any answer is non-public, and pin hostname requests to the exact validated `SocketAddr` set with `reqwest::ClientBuilder::resolve_to_addrs`. This removes the second unvalidated DNS lookup that could otherwise permit DNS rebinding. Literal or resolved loopback, private, link-local, CGNAT, benchmark, documentation, multicast, reserved, NAT64, Teredo and 6to4 addresses are rejected.

The Rust suite includes v2rayN resolver/config/log tests, strict-primary versus backup observation tests, schema-preserving and guarded config-update tests, serialized v2rayN/Happ operation tests, selected-process launch/window tests, settings normalization and debounced-position tests, exact fail-closed UI action/profile classifiers, network-target safety tests, product-surface/IPC contracts, window geometry contracts, active-client context transitions and pure Happ classifier tests. Runtime-specific Happ variation is handled through probe diagnostics and fail-closed behavior.
