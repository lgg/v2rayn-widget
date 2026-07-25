# 0030 - Active Client Context Consistency Report

## Status

Implementation and repository-controlled audit fixes are in progress. Exact-head Windows verification and merge remain pending.

## Audited baseline

`main` commit `e71285b73dfc9c180895ca48964a442c9936908f`.

## Audit method

The review followed persisted settings from every owning screen through Tauri events, Main store updates, automatic refresh effects, generic commands, adapter operation locks, client epochs and final status commits. It also rechecked all declared Main, Settings, Debug, Happ Setup and external Diagnostics surfaces, capability gating, IPC registration, window lifecycle, network target restrictions and existing regression contracts.

## Confirmed defects

1. Frontend treated inactive adapter settings as an active context change.
2. Main refreshed for inactive adapter fields.
3. Generic backend settings saves always invalidated the client epoch.
4. v2rayN-only mock mode could replace active Happ status.
5. Active v2rayN path changes could leave the previous installation's status in backend state.

## Corrections implemented

- added one frontend active-client context model shared by store invalidation and operational refresh keys;
- limited v2rayN context to path mode/path/mock while v2rayN is selected;
- limited Happ context to executable path/UIA consent while Happ is selected;
- preserved active operations and status for inactive adapter and general settings changes;
- changed backend state commit semantics to detect the actual active context transition;
- preserved current status when no active context changed, even if a caller supplied a replacement status;
- reset stale status for active non-mock v2rayN path changes;
- retained supplied mock/default status for active mock transitions;
- retained fail-closed reset for active Happ path/consent transitions.

## Regression coverage added

Frontend pure matrix:

- inactive Happ change while v2rayN is active;
- inactive v2rayN path/mock change while Happ is active;
- active v2rayN path and mock changes;
- active Happ path and consent changes;
- shared health-display settings alter the refresh key without invalidating context.

Frontend store integration:

- in-flight v2rayN toggle remains current across inactive Happ settings;
- in-flight Happ toggle remains current across inactive v2rayN path/mock settings.

Rust state transitions:

- unrelated general settings preserve epoch/status;
- inactive Happ settings preserve v2rayN epoch/status;
- inactive v2rayN path/mock preserves Happ epoch/status;
- active v2rayN path clears stale status;
- active v2rayN mock transition uses supplied mock status;
- existing selected-client and operation-lock tests remain.

## Files changed

- `src/frontend/src/features/active-client-context.ts`
- `src/frontend/src/features/active-client-context.test.ts`
- `src/frontend/src/features/dashboard-store.ts`
- `src/frontend/src/features/dashboard-store-active-context.test.ts`
- `src/frontend/src/app/App.tsx`
- `src/tauri/src/state/app_state.rs`
- architecture, roadmap and task/report 0030.

## Capability and screen audit result

No additional capability inflation or missing screen implementation was found:

- Main remains generic and capability-gated;
- Settings owns general/v2rayN fields and preserves adapter-owned Happ fields;
- Happ Setup owns Happ path/consent/probe and remains draft-safe;
- Debug Tools remains the v2rayN-specific diagnostic surface;
- Diagnostics remains an external webview without default Tauri IPC capability;
- v2rayN subscription and generic transport capabilities remain unsupported;
- Happ profile/restart/subscription capabilities remain research-required;
- Happ UI Automation remains explicit opt-in, PID-scoped, confidence-gated and fail-closed.

## Verification status

Pending on the final exact PR head:

- frontend dependency audit;
- complete frontend tests;
- production build;
- complete Rust formatting;
- Rust unit/integration tests;
- strict all-targets Clippy;
- strict release/no-default-features Clippy;
- locked check;
- portable release smoke build;
- artifact/diagnostics upload, cleanup and aggregate gates.

## Residual risks

- Shared health endpoint changes intentionally do not cancel a control operation. An older observational refresh can finish once, after which the existing endpoint watcher queues the authoritative refresh.
- Real Windows/Happ UI Automation remains version- and desktop-session-sensitive.

## Redaction review

Complete. No private endpoint, credential, local user path, subscription payload or private runtime log was introduced.

## Next steps

1. Complete exact-head permanent Release Quality verification.
2. Resolve every aggregate diagnostic if present.
3. Squash-merge only the exact green head.
4. Record final run and merge evidence through a minimal follow-up if required by the tracking convention.
