# 0043 - Command error and profile catalog audit

Date: 2026-08-03
Baseline: `main` at `c227cc022668addcc562867011b43e4fc41bf94c`
Status: Validation pending

## Repository state reviewed

- Default and product branch: `main`.
- Open pull requests at audit start: none.
- Open issues at audit start: none.
- Branches at audit start: `main` and intentional archival `beads-backup`.
- `beads-backup` is divergent historical migration data, not an unmerged product branch; `main` contains the current implementation and all recent product PRs through #38.

## Declared surface reviewed

The audit cross-checked the current PRD, UI reference, README, top-level roadmap, recent merged PRs, frontend dashboard/API state flow and the generic/backend adapter paths.

Declared current scope remains internally consistent:

- Windows 10/11 x64 compact widget and tray workflow;
- v2rayN detection, status, open, TUN control and experimental profile switching;
- Happ detection/open/setup/diagnostics and opt-in fail-closed experimental UI Automation;
- Settings, Happ Setup and Debug auxiliary surfaces;
- external diagnostics WebView;
- EN/RU localization and configurable visual/network behavior;
- subscriptions, a stable Happ public control contract and non-Windows support remain explicitly unsupported, blocked or deferred.

## Confirmed findings

### 1. Rust string command failures lost structured frontend recovery

`src/frontend/src/lib/api.ts` forwarded raw Tauri promise rejections. Dashboard recovery code recognizes privilege mismatch through `Error.message`, but Rust commands return `Result<_, String>` errors. A non-`Error` rejection could therefore fall back to generic copy and fail to expose the existing administrator relaunch action.

Resolution:

- all Tauri invocations now pass through one normalization boundary;
- existing `Error` instances are preserved;
- string and object `message` failures become `Error` with exact text;
- detail-free values use a stable `Tauri command failed` fallback;
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

## Additional audit observations

- Selected-client refresh, toggle, item selection and open commands retain backend epoch checks and per-adapter operation serialization.
- Main-window resize writes remain ordered and failure-tolerant.
- Diagnostics open requests remain coalesced.
- Settings/Happ draft-close recovery and native listener disposal remain implemented.
- No TODO/FIXME/HACK/unimplemented markers were found by repository search.
- No new unsupported subscription, transport-mode or cross-platform claims were introduced.

## Changed files

- `src/frontend/src/lib/api.ts`
- `src/frontend/src/lib/api.command-error.test.ts`
- `src/frontend/src/features/dashboard-store-command-error.test.ts`
- `src/tauri/src/adapters/v2rayn.rs`
- `project-tracking/tasks/0043-command-error-boundary-and-profile-catalog-resilience.md`
- `project-tracking/reports/0043-command-error-and-profile-catalog-audit.md`

## Validation evidence

Pending the Windows pull-request workflow on the final branch head.
