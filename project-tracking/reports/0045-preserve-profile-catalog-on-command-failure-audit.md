# 0045 - Preserve profile catalog on command failure audit

Date: 2026-08-05
Baseline: `main` at `b24075eb29f518a79c4d46f5e1e9dd997f5f7f28`
Status: Validation pending

## Repository state reviewed

- Default/product branch: `main`; the repository has no `master` branch.
- Open pull requests at audit start: none.
- Open issues at audit start: none.
- Product branches at audit start: only `main`.
- `beads-backup` remains an intentional tracking archive, not a product branch.

## Confirmed finding

The dashboard store used `listSelectedClientItems().catch(() => [])` in every catalog refresh path. This made a rejected Tauri command indistinguishable from an authoritative successful empty catalog.

Consequences:

- a transient IPC or command-level failure could erase a previously verified selector catalog;
- the UI could display no profiles even though the active client and its last known catalog remained valid;
- task 0044's correct successful-empty behavior made preserving failures especially important, because `[]` now intentionally clears state.

## Resolution

- introduced a nullable internal catalog result;
- `ProfileSummary[]` remains authoritative, including a successful empty array;
- `null` represents list-command failure and preserves the previous catalog;
- applied the distinction consistently across bootstrap, refresh, client selection, delayed toggle refresh, immediate/delayed item selection and initial external-settings hydration;
- retained existing status freshness and client-generation checks;
- added regressions for manual refresh, delayed toggle refresh and immediate/delayed item refresh failures;
- retained task 0044 regressions proving successful empty catalogs still clear stale entries.

## Review observations

- No Tauri command or shared type contract changed.
- No subscription or unsupported capability was introduced.
- Client switch still clears old-client profiles before loading the new context; a list failure therefore preserves the correct new-context empty state rather than restoring the old client's catalog.
- The change is frontend-only and minimally scoped.
- Public diff review found no secrets, local paths, private endpoints or user configuration data.

## Changed files

- `src/frontend/src/features/dashboard-store.ts`
- `src/frontend/src/features/dashboard-store-catalog-failure.test.ts`
- `project-tracking/tasks/0045-preserve-profile-catalog-on-command-failure.md`
- `project-tracking/reports/0045-preserve-profile-catalog-on-command-failure-audit.md`

## Validation evidence

Pending the pull-request Release Quality workflow on the final branch head.

## Validation boundary

Automated regressions can prove state transitions for successful empty results and rejected list commands. They do not claim manual validation against every real client version, installation layout or transient WebView2/IPC condition.
