# 0028 - Product Surface Completeness Audit Report

## Status

Implementation and deterministic product verification are complete. Final clean exact-head Release Quality and merge remain pending after correcting the strict Rust hygiene defects exposed by the first complete release-build attempt.

## Objective

Audit every capability and user-facing surface claimed by the project, trace each claim through frontend gating, generic Tauri commands and concrete adapters, identify unfinished or misleading behavior, and fix every repository-controlled defect found.

## Method

The audit cross-checked:

- `README.md` product and adapter claims;
- Main, Settings, Debug Tools and Happ Setup React surfaces;
- the external Diagnostics window and Tauri capability boundary;
- compact/full dashboard measurement and resizing;
- loading, empty, error, retry and unsaved-draft behavior;
- tray, native close, auxiliary-window and multi-monitor lifecycle;
- EN/RU localization catalogs;
- Zustand concurrency and stale-operation guards;
- generic client commands and adapter dispatch;
- v2rayN and Happ descriptors and implementations;
- path/process scoping, settings persistence and UI Automation consent;
- diagnostic network target validation;
- frontend/Rust tests and permanent Release Quality jobs;
- diagnostic artifacts rather than only high-level GitHub step conclusions;
- historical tracking records that still described completed work as pending.

## Declared capability matrix

### v2rayN

| Capability | Declared | Implementation result |
| --- | --- | --- |
| detect application/path | Supported | Implemented through validated installation detection and configured-path resolution. |
| process and connection status | Supported | Implemented through process, config, log and UI signals with conservative combined state resolution. |
| open application | Supported | Implemented with exact-installation process activation before launch fallback. |
| connect/disconnect | Supported | Implemented for Enable TUN through scoped UI Automation and controlled fallback paths. |
| profile list | Supported | Implemented through the compatibility adapter. |
| profile selection | Experimental | Implemented and capability-gated as experimental; not represented as stable. |
| restart | Supported | Implemented through the compatibility command layer. |
| generic Proxy/TUN/Mixed mode | Unsupported | Descriptor and README both mark it unavailable. |
| subscriptions | Unsupported | Listing, switching, refreshing and management remain explicitly unavailable. |

### Happ

| Capability | Declared | Implementation result |
| --- | --- | --- |
| process/path detection | Supported | Implemented for known executable/process names and validated configured paths. |
| open application | Supported | Implemented with exact configured-installation activation and no duplicate launch. |
| baseline diagnostics | Supported | Implemented for process, PID, window/action probe and generic IP/latency data. |
| connection state | Experimental after consent | Disabled/research-required by default; conservative PID-scoped UI Automation after explicit consent and successful probe. |
| connect/disconnect | Experimental after consent | Disabled by default; only high-confidence Connect/Disconnect actions are accepted. |
| Proxy/TUN/Mixed mode | Experimental after consent | Reported only when an exact visible UI label is available. |
| server/profile list or selection | Research required | Not implemented and not exposed as supported. |
| restart/reload | Research required | Not implemented. |
| subscriptions | Research required | Not implemented; Happ files are not modified. |

The adapter descriptors, frontend gating and concrete command dispatch match these maturity levels. Unsupported or research-required operations fail explicitly instead of emulating success.

## Screen audit

### Main dashboard

Verified:

- startup loading and bootstrap Retry;
- explicit client selection;
- capability-gated profile selector and connect button;
- status, clock, IP and latency rendering;
- refresh/open/copy/diagnostics actions;
- actionable UIPI elevation notice;
- serialized refresh and stale-client-result rejection;
- dynamic native height measurement;
- constrained-height vertical scrolling after native work-area fitting.

Corrections:

- `Unknown` previously displayed `OFF`; it now has separate EN/RU labels;
- the populated dashboard used `overflow-hidden`; lower controls now remain reachable through vertical scrolling when the native window is constrained.

### Settings

Verified:

- loading and initial-load error;
- Retry and Close actions;
- immediate UI settings application;
- persisted operational settings;
- path detection/validation;
- endpoint editing and normalization;
- unsaved-draft protection for custom and native close;
- constrained-layout scrolling.

Correction: initial-load failure previously offered only Close. Retry now repeats the complete settings/locales load and clears stale state.

### Debug Tools

Verified:

- initial probe loading, error and no-result states;
- scoped UI probe controls;
- profile, reload, config-only and full-toggle diagnostics;
- privilege/UIPI information;
- independently scrollable result/log panes;
- safe custom and native close behavior.

Correction: native close previously hid Debug directly and bypassed Main restoration. It now delegates to the common safe close command.

### Happ Setup

Verified:

- loading and initial-load error with Retry/Close;
- path detect/validate/clear;
- probe confidence requirements;
- explicit experimental consent;
- backend re-probe before enabling control;
- unsaved-draft protection for custom and native close;
- constrained-layout scrolling.

Correction: initial-load failure previously offered no Retry.

### Diagnostics

Verified:

- disabled-by-default setting gate;
- normalized HTTP(S) URL;
- reusable external webview;
- fitting on creation and reopen;
- decorated-frame-aware work-area fitting;
- exclusion from the default local IPC capability;
- absence of a remote capability scope.

The external page therefore does not receive the local Tauri command capability granted to Main, Settings, Debug and Happ Setup.

## Window lifecycle and multi-monitor findings

The previous implementation did not consistently fit windows to the active monitor work area. Settings, Happ Setup, Debug, Diagnostics and dynamically resized Main could extend behind a taskbar, outside a short work area or beyond a monitor after topology/DPI changes.

Corrections:

- reusable work-area fitting for all local and Diagnostics windows;
- negative desktop-coordinate support;
- short-work-area shrinking and position clamping;
- fitting when shown, restored, resized or reopened;
- conversion from target outer size to client size using measured frame/title-bar delta;
- Main restoration before auxiliary hide;
- auxiliary surface remains visible if Main restoration fails.

## Localization and security contracts

Corrections:

- added `UNKNOWN` / `НЕИЗВ.` labels;
- added exact EN/RU key-parity and nonblank-value tests;
- added an exact four-local-window Tauri surface contract;
- added a capability contract proving external Diagnostics is excluded from default IPC access.

## Regression coverage added

Frontend:

- Settings initial-load retry;
- Happ Setup initial-load retry;
- Unknown versus Disconnected rendering;
- constrained Main scrolling;
- EN/RU parity and nonblank values.

Rust:

- saved-position visibility threshold;
- fully off-screen and tiny-sliver rejection;
- negative-coordinate monitors;
- corrupt zero-size position rejection;
- short-work-area shrinking/clamping;
- decorated outer-to-inner size conversion;
- exact local surface registration;
- remote Diagnostics IPC exclusion.

## Verification history

### Implementation head `95bb525820ed155e923dc572cbf57b9e727279f4`

Release Quality #329 (`30102240110`) proved:

- frontend contracts, npm audit, complete tests and production build passed;
- Rust unit/integration tests passed, including 102 internal tests and both new product-surface contracts;
- locked Cargo check passed;
- portable release executable built successfully on the later full attempt.

The first Rust attempt disappeared during release linking without a normal log or diagnostics artifact. The runner became unavailable and a same-SHA retry remained queued. This was an infrastructure interruption.

### Finalized tracking head `40153b22ba7ea23cedd8f20ecdcaf5d039c10dd5`

Release Quality #331 (`30104073460`) completed the portable release build, portable artifact upload, diagnostics upload and cleanup. The aggregate failure step nevertheless correctly blocked the job. Inspection of `rust-diagnostics` showed two hidden failures that the jobs API's continue-on-error conclusions did not expose clearly:

1. `src/client_commands.rs` retained an unused `Manager` import, causing both strict Clippy configurations to fail under `-D warnings`.
2. `src/utils/window_position.rs` was not rustfmt-clean.

The portable executable still built, but a successful binary alone was insufficient for acceptance. Both defects were fixed by removing the stale import and formatting the complete Rust workspace. Temporary patch workflows were removed afterward.

## Repository-controlled issues resolved

1. Missing Settings retry.
2. Missing Happ Setup retry.
3. Unknown state misrepresented as OFF.
4. Unsafe auxiliary close ordering.
5. Native Debug close bypassing safe restoration.
6. Missing work-area fitting for local windows.
7. Missing fitting when reopening Diagnostics.
8. Decorated Diagnostics outer/inner sizing mismatch.
9. Main content clipping on constrained heights.
10. Missing locale parity contract.
11. Missing remote Diagnostics IPC-isolation contract.
12. Stale task/report 0018 completion state.
13. Unused Rust import breaking strict Clippy.
14. New Rust window-position code not formatted according to workspace rustfmt.

## Residual boundaries

- Real v2rayN/Happ UI Automation was not executed against every installed application version, language and Windows desktop session in CI.
- UI Automation remains sensitive to visible UI structure and privilege/UIPI context and intentionally fails closed on insufficient confidence.
- v2rayN profile switching remains experimental.
- Happ connection control/status/transport reading remains explicit opt-in experimental functionality.
- Happ profile/server selection, restart/reload and subscriptions remain research-required.
- v2rayN subscriptions and generic transport-mode reporting remain unsupported.
- Diagnostics can load a user-configured HTTP(S) page, but that remote webview has no default Tauri IPC capability.
- Deterministic layout/work-area contracts do not replace screenshot comparison across every DPI, font renderer and GPU combination.

## Definition of done remaining

- complete one clean exact-head Release Quality run after the Rust hygiene corrections;
- squash-merge PR #17;
- write the final run and merge evidence back to task/report 0028.
