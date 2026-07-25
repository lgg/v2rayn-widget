# 0030 - Active Client Context Consistency Report

## Status

Complete. Exact implementation head `15829dd0318fcf901bc913dafed8ae5752db152d` passed permanent Release Quality #363 (`30143652586`) and PR #21 was squash-merged into `main` as `01260a564a39ff4a2a0931fddc440decb84c6363`.

## Audited baseline

`main` commit `e71285b73dfc9c180895ca48964a442c9936908f`.

## Audit method

The review followed persisted settings from every owning screen through Tauri events, Main store updates, automatic refresh effects, generic commands, adapter operation locks, client epochs, capability catalog requests, client-switch completion/rollback and final status commits. It also rechecked all declared Main, Settings, Debug, Happ Setup and external Diagnostics surfaces, capability gating, IPC registration, window lifecycle, network target restrictions and existing regression contracts.

## Confirmed defects

1. Frontend treated inactive adapter settings as an active context change.
2. Main refreshed for inactive adapter fields.
3. Generic backend settings saves always invalidated the client epoch.
4. v2rayN-only mock mode could replace active Happ status.
5. Active v2rayN path changes could leave the previous installation's status in backend state.
6. Out-of-order capability catalog responses could overwrite a newer inactive-Happ descriptor.
7. Client selection completion/failure could overwrite newer general settings with an older pre-selection snapshot.

## Corrections implemented

- added one frontend active-client context model shared by store invalidation and operational refresh keys;
- limited v2rayN context to path mode/path/mock while v2rayN is selected;
- limited Happ context to executable path/UIA consent while Happ is selected;
- preserved active operations and status for inactive adapter and general settings changes;
- changed backend state commit semantics to detect the actual active context transition;
- preserved current status when no active context changed, even if a caller supplied a replacement status;
- reset stale status for active non-mock v2rayN path changes;
- retained supplied mock/default status for active mock transitions;
- retained fail-closed reset for active Happ path/consent transitions;
- added independent catalog request/settings revisions so stale capability responses are rejected;
- kept newer settings already received when client selection succeeds;
- rolled back only `selected_client` when client selection fails.

## Regression coverage added

Frontend pure matrix:

- inactive Happ change while v2rayN is active;
- inactive v2rayN path/mock change while Happ is active;
- active v2rayN path and mock changes;
- active Happ path and consent changes;
- shared health-display settings alter the refresh key without invalidating context.

Frontend store integration:

- in-flight v2rayN toggle remains current across inactive Happ settings;
- in-flight Happ toggle remains current across inactive v2rayN path/mock settings;
- an older capability catalog response cannot replace a newer descriptor;
- successful client selection retains newer settings events;
- failed client selection rolls back only the selected client and retains newer settings.

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

## Final verification and merge evidence

Exact implementation head `15829dd0318fcf901bc913dafed8ae5752db152d` passed permanent Release Quality #363 (`30143652586`) on the dedicated `[self-hosted, v2rayn-widget-ci]` Windows runner.

- workflow contracts and immutable prerequisites: success;
- frontend dependency audit: success;
- complete frontend tests: success;
- production frontend build: success;
- complete Rust formatting: success;
- Rust unit/integration suites: 124 passed, 0 failed;
- strict all-targets Clippy: success;
- strict release/no-default-features Clippy: success;
- locked Rust build: success;
- portable release smoke build: success;
- frontend and Rust artifact/diagnostics upload: success;
- cleanup and aggregate gates: success.

The first otherwise-clean run exposed only canonical Rust formatting drift in three new test method calls. The exact rustfmt output was applied, and the complete exact-head gate was rerun successfully rather than bypassed.

PR #21 was squash-merged into `main` as commit `01260a564a39ff4a2a0931fddc440decb84c6363`. This evidence-only follow-up changes no product implementation.

## Residual risks

- Shared health endpoint changes intentionally do not cancel a control operation. An older observational refresh can finish once, after which the existing endpoint watcher queues the authoritative refresh.
- Real Windows/Happ UI Automation remains version- and desktop-session-sensitive.

## Redaction review

Complete. No private endpoint, credential, local user path, subscription payload or private runtime log was introduced.

## Completion

Task 0030 is complete. No repository-controlled implementation, capability claim, screen or documentation item identified by this audit remains open. Future work remains limited to explicitly documented experimental/research-required compatibility and real-world client-version testing.
