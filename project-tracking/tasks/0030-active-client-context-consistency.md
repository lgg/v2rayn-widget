# 0030 - Active Client Context Consistency

## Status

Complete. Exact implementation head `15829dd0318fcf901bc913dafed8ae5752db152d` passed permanent Release Quality #363 (`30143652586`) and PR #21 was squash-merged into `main` as `01260a564a39ff4a2a0931fddc440decb84c6363`.

## Context

Task 0029 made backend Happ settings updates preserve an unrelated active v2rayN context. A new independent audit from exact `main` commit `e71285b73dfc9c180895ca48964a442c9936908f` traced the same contract through frontend settings events, automatic refresh dependencies, asynchronous catalog/client-switch results and the generic backend settings commit path.

The audit found that the previous correction was incomplete outside `client_commands.rs`.

## Objective

Make client epoch, dashboard status, in-flight operation ownership, capability freshness and automatic refresh depend only on the operational context of the currently selected adapter.

## In scope

- frontend `settings-updated` handling;
- automatic operational refresh dependencies in Main;
- backend settings/status commit semantics;
- v2rayN path and mock-mode transitions;
- Happ path and experimental-control transitions;
- non-operational general settings;
- inactive adapter settings;
- capability catalog request ordering;
- client-switch success/failure freshness;
- regression tests and architecture/tracking documentation;
- full permanent Windows Release Quality verification.

## Out of scope

- implementing unsupported subscription operations;
- promoting Happ UI Automation from experimental to stable;
- changing adapter capability declarations;
- changing settings storage format or Tauri command signatures.

## Confirmed findings

1. `applyExternalSettings` invalidated frontend generations, status, profiles and action loading when any adapter field changed, including settings owned by the inactive adapter.
2. Main's operational refresh effect depended on both v2rayN and Happ fields, so changing an inactive adapter started an unrelated refresh.
3. `update_settings` always called the backend context-invalidating commit path, so changing theme, autostart, polling, diagnostics or health display settings could make a valid in-flight client operation return `CLIENT_CONTEXT_CHANGED`.
4. `mock_mode_enabled` is implemented only by the v2rayN adapter, but changing it while Happ was active could replace Happ status with a v2rayN mock status.
5. Changing the active v2rayN path invalidated the epoch but retained the previous installation's status in backend state until a later refresh.
6. Out-of-order capability catalog requests could let an older inactive-Happ descriptor overwrite a newer one after inactive changes stopped incrementing the client generation.
7. Client selection completion or failure could overwrite newer general settings with the pre-selection snapshot.

## Active-context rules

- selected-client change always invalidates;
- active v2rayN context consists of path mode, manual path and mock mode;
- active Happ context consists of executable path and UI Automation consent;
- inactive adapter fields never invalidate the selected adapter;
- general appearance, tray, polling and diagnostics settings preserve epoch/status;
- shared health-display settings request a refresh but do not cancel the active operation;
- active v2rayN path changes clear stale status;
- active mock-mode transitions use the supplied v2rayN mock/default status;
- active Happ path/consent changes keep the existing fail-closed reset behavior;
- capability catalog responses are accepted only from the newest request for the current settings/client revision;
- client-switch completion preserves newer settings events, while rollback changes only `selected_client`.

## Acceptance criteria

- [x] Frontend generation/status reset is selected-client-aware.
- [x] Main automatic refresh key contains only active adapter fields plus shared health-display settings.
- [x] Inactive Happ changes do not cancel or discard an in-flight v2rayN result.
- [x] Inactive v2rayN path/mock changes do not cancel or discard an in-flight Happ result.
- [x] General settings preserve backend epoch and selected-client status.
- [x] Inactive adapter changes preserve backend epoch and selected-client status.
- [x] Mock mode does not write v2rayN status into active Happ state.
- [x] Active v2rayN path changes invalidate context and clear stale status.
- [x] Active v2rayN mock changes invalidate context and use the supplied mock/default status.
- [x] Existing active Happ invalidation remains intact.
- [x] Older capability catalog responses cannot overwrite newer descriptors.
- [x] Client-switch completion and rollback preserve newer general settings.
- [x] Frontend tests, audit and production build pass on exact PR head.
- [x] Rust formatting, tests, both strict Clippy passes, locked check and portable build pass on exact PR head.
- [x] Artifacts, diagnostics, cleanup and aggregate gates pass.
- [x] PR is squash-merged into `main` and final evidence is recorded.

## Final verification evidence

Exact implementation head `15829dd0318fcf901bc913dafed8ae5752db152d` passed Release Quality #363 (`30143652586`) on the dedicated `[self-hosted, v2rayn-widget-ci]` Windows runner.

- workflow contracts and immutable prerequisites: success;
- frontend dependency audit, complete tests and production build: success;
- complete Rust formatting: success;
- Rust unit/integration suites: 124 passed, 0 failed;
- strict all-targets Clippy: success;
- strict release/no-default-features Clippy: success;
- locked Rust build: success;
- portable release smoke artifact and diagnostics: success;
- cleanup and aggregate failure gates: clean.

The preceding run exposed only canonical formatting drift in three new Rust test calls. The exact rustfmt diff was applied and the complete gate was rerun successfully rather than bypassed.

PR #21 was squash-merged into `main` as `01260a564a39ff4a2a0931fddc440decb84c6363`.

## Decisions

- No command/API or settings-schema change was needed.
- Context ownership is based on the selected adapter, not every persisted adapter field.
- Shared health settings trigger eventual refresh without invalidating the client epoch.
- Capability catalog ordering uses its own revision rather than incorrectly reusing client generation.
- Selection rollback restores only the selected-client field.
- Existing experimental and unsupported capability states remain unchanged.

## Risks

- An observational refresh already running with old shared health endpoints may finish once before the queued refresh with new endpoints; the newer refresh remains authoritative and no control operation is cancelled.
- Real Happ UI Automation compatibility remains version-sensitive and outside this context-lifecycle correction.

## Security and redaction review

- No credentials, private endpoints, user paths, subscription data or runtime logs are included.
- Test paths are neutral placeholders.

## Related work

- Task/report 0029 - safe close, work-area and initial adapter-context hardening.
- PR #21 - active client context and asynchronous freshness corrections.
- `project-tracking/reports/0030-active-client-context-consistency-report.md`
