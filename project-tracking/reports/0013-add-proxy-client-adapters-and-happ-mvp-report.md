# 0013 - Proxy Client Adapters and Happ MVP Final Report

## Summary

The v2rayN-only application boundary has been replaced with a real operational multi-client adapter architecture in `feature/proxy-client-adapters` and pull request #1.

The implementation keeps v2rayN as the migration-safe default, preserves its existing control and diagnostics paths, adds a selectable Happ adapter, and completes a safe Happ baseline plus an explicitly opt-in experimental Windows UI Automation control path.

The task is complete. Subscription management and future clients are separate roadmap phases and are not represented as missing parts of this refactor.

## Architecture Result

`ProxyClientAdapter` now owns client operations rather than only metadata:

- descriptor and capabilities;
- status refresh modes;
- connection toggle;
- item list and selection;
- application open;
- adapter diagnostics.

`client_commands.rs` resolves the selected adapter and invokes the common contract. It contains no per-client operation branching. Adding another registered adapter no longer requires duplicating the frontend or rewriting the generic command dispatcher.

Compatibility decisions:

- old settings deserialize to `selected_client = v2rayn`;
- legacy v2rayN commands remain registered;
- compatibility fields such as `tun_enabled` and `active_profile_name` remain temporarily;
- subscriptions are modeled as a separate future concern.

## v2rayN Result

The compatibility adapter preserves:

- installation/path detection;
- process monitoring;
- config, database and log reading;
- combined status resolution;
- external IP and latency;
- Enable TUN UI Automation;
- config plus reload/restart fallback;
- profile enumeration;
- experimental active profile switching;
- open/restart behavior;
- privilege/UIPI diagnostics.

Explicitly unsupported:

- subscription listing;
- subscription switching;
- subscription refresh/update;
- subscription add/remove/manage;
- generic subscription metadata;
- generic Proxy/TUN/Mixed reporting.

Profile selection is not described as subscription switching.

## Happ Result

### Safe baseline

Implemented:

- known process detection and PID capture;
- executable path from a running process;
- common Windows installation path discovery;
- validated optional manual executable path;
- application launch;
- external IP and latency diagnostics;
- conservative status behavior;
- dedicated setup and diagnostics window.

The adapter never treats process existence alone as proof of an active VPN connection.

### Research decision

No stable documented public CLI/local API/daemon IPC contract was selected for production control. Internal database and config mutation was rejected.

Windows UI Automation was therefore implemented only as an experimental, disabled-by-default fallback with these safeguards:

- explicit persisted user consent;
- target window must belong to the detected Happ PID;
- only explicit Connect/Disconnect actions are accepted;
- English and Russian action labels are recognized;
- Auto connect, Reconnect and settings labels are rejected;
- a high confidence threshold is required;
- ambiguous or missing controls produce a safe error without clicking;
- Invoke, Toggle, LegacyAccessible and native button fallbacks are isolated in the Happ controller;
- diagnostics expose the process, executable, window, inferred state, transport, action, confidence and redacted UI tree.

When the UI exposes an exact selected Proxy, TUN or Mixed label, the adapter reports it experimentally. Otherwise transport remains Unknown.

### Still intentionally unavailable

- stable official Happ API support;
- server/profile enumeration and selection;
- daemon restart/reload;
- subscriptions;
- internal config/database mutation.

## Frontend Result

Implemented:

- persisted v2rayN/Happ selector;
- generic refresh/toggle/open/item actions;
- stale status/item clearing after adapter switch;
- capability-gated controls;
- adapter maturity/status note;
- Happ setup button next to the selected client;
- separate Happ Setup window;
- path detection and validation;
- explicit experimental-control consent;
- runtime diagnostic probe and expandable UI tree;
- EN/RU localization;
- tests for selector, setup persistence and diagnostics rendering.

The Happ connect button remains disabled until the experimental opt-in is saved.

## Verification

Windows Quality validates:

- frontend dependency installation;
- frontend unit/component tests;
- TypeScript/Vite production build;
- frontend distribution transfer to the Tauri job;
- formatting of changed Rust sources;
- Rust unit and existing v2rayN regression tests;
- `cargo check --locked`;
- short-lived diagnostics artifacts.

Verified in the expanded implementation pass:

- frontend test suite: 13 tests passed;
- frontend production build passed;
- Rust test suite: 31 tests passed;
- `cargo check --locked` passed;
- existing v2rayN resolver/config/log regression tests passed;
- adapter registry, dynamic capability and settings migration tests passed;
- Happ UI classifier tests passed.

Target-machine variation is handled by diagnostics and fail-closed behavior rather than by claiming compatibility with every future Happ UI version. The control feature remains visibly experimental and disabled by default.

## Security and Public Data Review

The change contains no:

- tokens or credentials;
- real subscription URLs;
- private proxy endpoints;
- real local installation paths;
- real client configs or logs;
- personal data.

Happ integration does not write undocumented configuration, database or subscription files.

## Result

The repository now has a genuine reusable adapter platform rather than a v2rayN implementation wrapped in client-name conditionals.

v2rayN remains the stable default and retains its current behavior. Happ is selectable, configurable and diagnosable, with a conservative safe baseline and optional experimental connection control. Unsupported subscription operations remain explicitly unavailable instead of being simulated.
