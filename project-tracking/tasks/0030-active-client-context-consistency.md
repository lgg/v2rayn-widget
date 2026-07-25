# 0030 - Active Client Context Consistency

## Status

Implementation in progress on `audit/0030-active-context-consistency`.

## Context

Task 0029 made backend Happ settings updates preserve an unrelated active v2rayN context. A new independent audit from exact `main` commit `e71285b73dfc9c180895ca48964a442c9936908f` traced the same contract through frontend settings events, automatic refresh dependencies and the generic backend settings commit path.

The audit found that the previous correction was incomplete outside `client_commands.rs`.

## Objective

Make client epoch, dashboard status, in-flight operation ownership and automatic refresh depend only on the operational context of the currently selected adapter.

## In scope

- frontend `settings-updated` handling;
- automatic operational refresh dependencies in Main;
- backend settings/status commit semantics;
- v2rayN path and mock-mode transitions;
- Happ path and experimental-control transitions;
- non-operational general settings;
- inactive adapter settings;
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

## Active-context rules

- selected-client change always invalidates;
- active v2rayN context consists of path mode, resolved manual path input and mock mode;
- active Happ context consists of executable path and UI Automation consent;
- inactive adapter fields never invalidate the selected adapter;
- general appearance, tray, polling and diagnostics settings preserve epoch/status;
- shared health-display settings request a refresh but do not cancel the active operation;
- active v2rayN path changes clear stale status;
- active mock-mode transitions use the supplied v2rayN mock/default status;
- active Happ path/consent changes keep the existing fail-closed reset behavior.

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
- [ ] Frontend tests, audit and production build pass on exact PR head.
- [ ] Rust formatting, tests, both strict Clippy passes, locked check and portable build pass on exact PR head.
- [ ] Artifacts, diagnostics, cleanup and aggregate gates pass.
- [ ] PR is squash-merged into `main` and final evidence is recorded.

## Verification plan

1. Run pure frontend active-context matrix tests.
2. Run dashboard-store in-flight action regressions.
3. Run Rust state transition tests for unrelated, inactive and active changes.
4. Run complete permanent Release Quality workflow on the exact PR head.
5. Inspect aggregate diagnostics rather than relying only on individual continue-on-error steps.
6. Squash-merge only the exact green head.

## Decisions

- No command/API or settings-schema change is needed.
- Context ownership is based on the selected adapter, not on every persisted adapter field.
- Shared health settings trigger eventual refresh through existing frontend watchers/effects without invalidating the client epoch.
- Existing experimental and unsupported capability states remain unchanged.

## Risks

- An observational refresh already running with old shared health endpoints may finish once before the queued refresh with new endpoints; the newer refresh remains authoritative and no control operation is cancelled.
- Real Happ UI Automation compatibility remains version-sensitive and outside this context-lifecycle correction.

## Security and redaction review

- No credentials, private endpoints, user paths, subscription data or runtime logs are included.
- Test paths are neutral placeholders.

## Related work

- Task/report 0029 - safe close, work-area and initial adapter-context hardening.
- `project-tracking/reports/0030-active-client-context-consistency-report.md`
