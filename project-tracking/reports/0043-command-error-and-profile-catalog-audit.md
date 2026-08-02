# 0043 - Command error and profile catalog audit

Date: 2026-08-03
Baseline: `main` at `c227cc022668addcc562867011b43e4fc41bf94c`
Implemented by: PR #39
Merged result: `ff47ac311198afcec86a99ec086beeb743e5269f`
Status: Verified and merged

## Repository state reviewed

- Default and product branch: `main` (the repository has no `master` branch).
- Open pull requests at audit start: none.
- Open issues at audit start: none.
- Branches at audit start: `main` and intentional archival `beads-backup`.
- `beads-backup` is divergent historical migration data, not an unmerged product branch; `main` contained the current implementation and all recent product PRs through #38 before this audit.

## Declared surface reviewed

The audit cross-checked the current PRD, UI reference, README, top-level roadmap, recent merged PRs, frontend dashboard/API state flow, auxiliary surfaces, generic client commands and the v2rayN/Happ adapter boundaries.

Declared current scope remains internally consistent:

- Windows 10/11 x64 compact widget and tray workflow;
- v2rayN detection, status, open, TUN control and experimental profile switching;
- Happ detection/open/setup/diagnostics and opt-in fail-closed experimental UI Automation;
- Settings, Happ Setup and Debug auxiliary surfaces;
- external diagnostics WebView;
- EN/RU localization and configurable visual/network behavior;
- subscriptions, a stable Happ public control contract and non-Windows support remain explicitly unsupported, blocked or deferred.

## Confirmed findings and resolutions

### 1. Rust string command failures lost structured frontend recovery

`src/frontend/src/lib/api.ts` forwarded raw Tauri promise rejections. Dashboard recovery code recognizes privilege mismatch through `Error.message`, but Rust commands return `Result<_, String>` errors. A non-`Error` rejection could therefore fall back to generic copy and fail to expose the existing administrator relaunch action.

Resolution:

- all Tauri invocations now pass through one normalization boundary;
- existing `Error` instances are preserved;
- string and object `message` failures become `Error` with exact text;
- detail-free values use a stable `Tauri command failed` fallback;
- argument-free commands preserve the exact one-argument Tauri call contract;
- frontend regressions cover the API boundary and dashboard `UIPI_MISMATCH` recovery action.

### 2. Profile reads conflated a real empty catalog with read failure

The v2rayN adapter delegated profile listing to a compatibility command that returned an empty vector when config reading failed. The main dashboard therefore could not distinguish a valid zero-profile result from a transient read failure.

Resolution:

- the generic v2rayN adapter now performs the serialized context-bound read directly;
- successful reads update a cache scoped to the exact resolved installation path;
- a successful empty catalog is cached and returned as empty;
- a later read failure for the same path preserves the last successful catalog;
- a different installation path cannot reuse that data;
- a first failure without a verified matching cache remains an error;
- a Rust regression verifies non-empty, empty and cross-path cache behavior.

### 3. Expected stale client-open cancellation leaked into the new context

The backend correctly rejects a queued client-open request with `CLIENT_CONTEXT_CHANGED` when the selected adapter or its active settings change before the operation owns the lock. The frontend open path had no ownership guard, so that expected cancellation could be shown as a launch error after the user had already switched context.

Resolution:

- `openSelectedClient` suppresses only normalized `CLIENT_CONTEXT_CHANGED` cancellations;
- all real launch failures continue to propagate with their exact backend details;
- a regression verifies that stale cancellation resolves without creating a false failure.

## CI-discovered implementation regression

The first implementation run exposed that a naïve shared wrapper changed argument-free calls from `invoke(command)` to `invoke(command, undefined)`. An existing exact API-contract test caught it. The wrapper was corrected to preserve original call arity before final validation. A separate transient artifact-finalization timeout also occurred on an intermediate run and did not recur on the final head.

## Additional audit observations

- Selected-client refresh, toggle, item selection and open commands retain backend epoch checks and per-adapter operation serialization.
- Main-window resize writes remain ordered and failure-tolerant.
- Diagnostics open requests remain coalesced.
- Settings/Happ draft-close recovery and native listener disposal remain implemented.
- Repository search found no TODO/FIXME/HACK/unimplemented markers requiring action.
- No unsupported subscription, transport-mode or cross-platform claims were introduced.
- No confirmed code defect remained after the final static review and green Windows pipeline.

## Changed files

- `src/frontend/src/lib/api.ts`
- `src/frontend/src/lib/api.command-error.test.ts`
- `src/frontend/src/features/dashboard-store-command-error.test.ts`
- `src/tauri/src/adapters/v2rayn.rs`
- `project-tracking/tasks/0043-command-error-boundary-and-profile-catalog-resilience.md`
- `project-tracking/reports/0043-command-error-and-profile-catalog-audit.md`

## Validation evidence

Release Quality run #513 (`30770443516`) validated PR #39 branch head `12de3ec1dee507b1d43ab3cf0faf8d616d971826` on the repository's self-hosted Windows x64 runner:

- frontend dependency audit: passed;
- frontend tests: 111 passed;
- frontend production build: passed;
- frontend distribution and diagnostics artifacts: uploaded;
- Rust formatting: passed;
- Rust tests: 137 passed (127 unit + 9 product-surface contracts + 1 quality-storage contract);
- debug Clippy with `-D warnings`: passed;
- release Clippy with `-D warnings`: passed;
- Rust build/check: passed;
- portable `v2rayn-widget.exe` release smoke artifact: built and uploaded;
- portable artifact size: 6,689,921 bytes;
- portable artifact SHA-256 archive digest: `1e40f9fb954f1b4ccafd02e567bdf8872c6cf0a06b9f64fdd2a22b94a5a02e0e`.

## Honest validation boundary

This audit validates implementation, state ownership, contracts, tests, compilation and Windows release packaging. It does not claim a fresh manual end-to-end session against every real-world v2rayN/Happ version and installation shape. Those external-client matrix checks remain environment-dependent, and deferred/unsupported features remain documented as such rather than being represented as complete.
