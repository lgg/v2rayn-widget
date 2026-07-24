# 0028 - Product Surface Completeness Audit Report

## Status

Implementation and deterministic product verification are complete. Final exact-head Release Quality and merge remain pending because the dedicated self-hosted runner became unavailable during the final portable release link.

## Objective

Audit every capability and user-facing surface claimed by the project, trace each claim through frontend gating, generic Tauri commands and concrete adapters, identify unfinished or misleading behavior, and fix every repository-controlled defect found.

## Method

The audit reviewed and cross-checked:

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
- existing frontend/Rust tests and permanent Release Quality jobs;
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
| generic Proxy/TUN/Mixed mode | Unsupported | No false implementation claim; descriptor and README both mark it unavailable. |
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

The adapter descriptors, frontend capability gating and concrete command dispatch match these declared maturity levels. Unsupported or research-required operations fail explicitly instead of silently emulating success.

## Screen audit

### Main dashboard

Verified:

- startup loading state;
- bootstrap error with Retry;
- explicit client selection;
- capability-gated profile selector and connect button;
- truthful status, clock, IP and latency rendering;
- refresh/open/copy/diagnostics actions;
- actionable UIPI elevation notice;
- serialized refresh and stale-client-result rejection;
- dynamic native height measurement;
- constrained-height vertical scrolling after native work-area fitting.

Correction: `Unknown` connection state previously displayed `OFF`. It now has separate English and Russian labels and cannot be confused with a confirmed disconnect.

Correction: the populated dashboard previously used `overflow-hidden`; when the native window was reduced for a short work area, lower controls could be clipped. It is now vertically scrollable and protected by a render regression test.

### Settings

Verified:

- complete loading state;
- initial-load error with Retry and Close;
- immediate UI settings application;
- persisted operational settings;
- path detection/validation;
- endpoint editing and normalization;
- unsaved-draft protection for both custom and native close requests;
- scrollable content in constrained windows.

Correction: initial-load failure previously offered only Close. Retry now performs the complete settings/locales reload and clears stale error/loading state.

### Debug Tools

Verified:

- initial probe loading, error and no-result states;
- scoped UI probe controls;
- profile, reload, config-only and full-toggle diagnostics;
- privilege/UIPI information;
- independently scrollable result and log panes;
- safe native and custom close behavior.

Correction: the native title-bar close path previously hid Debug directly and bypassed safe Main restoration. It now delegates to the common close command.

### Happ Setup

Verified:

- loading and initial-load error with Retry and Close;
- path detect/validate/clear;
- probe result and confidence requirements;
- explicit experimental-consent checkbox;
- backend re-probe enforcement before enabling control;
- unsaved-draft protection for custom and native close;
- scrollable constrained layout.

Correction: initial-load failure previously offered no Retry. The complete load can now be repeated without reopening the window.

### Diagnostics

Verified:

- disabled-by-default setting gate;
- normalized HTTP(S) URL;
- one reusable external webview instead of duplicate windows;
- fitting on both creation and later reopen;
- fitting that accounts for decorated-window frame/title-bar size;
- no inclusion in the default local IPC capability and no remote capability scope.

The external Diagnostics page therefore does not receive the local Tauri command capability granted to Main, Settings, Debug and Happ Setup.

## Window lifecycle and multi-monitor findings

The previous implementation restored only the saved Main position and did not consistently fit windows to the active monitor work area. Fixed-size Settings/Happ windows, Debug, Diagnostics and dynamically resized Main could extend behind a taskbar, outside a short work area or beyond a monitor after topology/DPI changes.

Corrections:

- added reusable work-area fitting for all local and Diagnostics windows;
- supports negative desktop coordinates;
- shrinks windows to short work areas;
- clamps position while preserving a visible surface;
- applies fitting when windows are shown, restored, resized or reopened;
- converts target outer size to client size using the measured frame delta for decorated windows;
- restores Main before hiding any auxiliary window;
- leaves the auxiliary surface visible if Main restoration fails.

## Localization and contract findings

Corrections:

- added `UNKNOWN` / `НЕИЗВ.` labels;
- added a permanent EN/RU catalog parity test;
- both catalogs must have exactly the same keys;
- every translation value must be nonblank;
- added a permanent Tauri surface contract for exactly four local React windows;
- added a permanent capability contract proving that external Diagnostics is excluded from default IPC access.

## Regression coverage added

Frontend:

- Settings initial-load retry;
- Happ Setup initial-load retry;
- Unknown versus Disconnected connect-button rendering;
- constrained Main vertical scrolling;
- exact EN/RU key parity and nonblank values.

Rust:

- saved-position visibility threshold;
- fully off-screen rejection;
- tiny unusable sliver rejection;
- negative-coordinate monitor support;
- zero-size corrupt position rejection;
- short work-area shrinking and clamping;
- decorated outer-to-inner size conversion;
- exact local surface registration;
- remote Diagnostics exclusion from default IPC capability.

## Verification completed on the implementation

On clean head `95bb525820ed155e923dc572cbf57b9e727279f4`, Release Quality run #329 (`30102240110`) completed successfully through:

- frontend workflow contracts;
- locked dependency restoration with lifecycle scripts disabled;
- locked Tauri/NSIS prerequisite validation;
- npm audit;
- complete frontend test suite including all new regressions;
- production frontend build and artifact upload;
- Rust/MSVC prerequisite validation;
- full Rust formatting check;
- complete Rust unit/integration tests including all new contracts;
- strict all-targets Clippy;
- strict release/no-default-features Clippy;
- locked Cargo check.

The first portable release link ended when the self-hosted job disappeared without producing a normal step conclusion, job log or Rust diagnostics artifact. A retry was queued on the same SHA, but the dedicated runner remained unavailable. This is tracked as an infrastructure interruption rather than represented as a successful build. No merge is permitted until a clean exact-head run completes the portable build, artifacts and cleanup.

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

## Residual boundaries

- Real v2rayN/Happ UI Automation was not executed against every installed application version, language and Windows desktop session in CI.
- UI Automation remains sensitive to visible UI structure and privilege/UIPI context; the implementation intentionally fails closed when confidence is insufficient.
- v2rayN profile switching remains experimental.
- Happ connection control/status/transport reading remains explicit opt-in experimental functionality.
- Happ profile/server selection, restart/reload and subscriptions remain research-required.
- v2rayN subscriptions and generic transport-mode reporting remain unsupported.
- Diagnostics can load a user-configured HTTP(S) page, but that remote webview has no default Tauri IPC capability.
- The audit provides deterministic layout/work-area contracts, not screenshot comparison across every DPI, font renderer and GPU combination.

## Definition of done remaining

- complete one clean exact-head Release Quality run including portable release build, artifact upload and cleanup;
- squash-merge PR #17;
- write the final run and merge evidence back to task/report 0028.
