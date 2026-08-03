# 0044 - Safe app actions and empty profile catalog audit

Date: 2026-08-03
Baseline: `main` at `ea75ad015f9d56a01b4ead272efcccfe3b15ef55`
Status: Validation pending

## Repository state reviewed

- Default/product branch: `main`; the repository has no `master` branch.
- Open pull requests at audit start: none.
- Open issues at audit start: none.
- Product branches at audit start: only `main`.
- `beads-backup` remains an intentional archive whose unique content is restricted to `.beads/backup/*`.

## Confirmed findings

### 1. Application-wide destructive actions bypassed draft protection

Settings and Happ Setup already own native close requests and display an unsaved-change confirmation. However, tray Exit, frontend Exit and administrator relaunch called `app.exit(0)` through paths that did not ask those surfaces to close first. A user could therefore lose an unsaved draft by choosing Exit from the tray or relaunching with administrator privileges from Main, Settings or Debug.

Resolution:

- added a shared Rust application-action guard;
- enumerated only the two surfaces that own persistent drafts: Settings and Happ Setup;
- visible draft surfaces are restored/focused and receive their existing safe-close event;
- the guard polls visibility for a bounded period;
- Exit/Relaunch proceeds only when every requested surface has hidden;
- a dirty/busy surface remains visible, keeps its existing confirmation UI and blocks the destructive action;
- tray Exit and frontend commands now route through the guard;
- frontend exact-command and Rust product-contract regressions prevent fallback to unsafe direct commands.

### 2. Delayed refreshes ignored a verified empty profile catalog

The delayed refresh after toggle and item selection applied profiles only when `length > 0`. Task 0043 made a successful empty catalog meaningful and moved transient read recovery into the v2rayN adapter. Keeping the frontend length gate therefore preserved deleted/stale options even though the backend had authoritatively returned no profiles.

Resolution:

- delayed refresh paths now apply the profile result whenever the corresponding status result is accepted as current/fresh;
- an empty result clears stale selector entries;
- adapter-owned transient-read fallback remains responsible for preserving the last verified catalog on actual read failure;
- focused fake-timer regressions cover both toggle and item-selection delayed refreshes.

## Review observations

- The change reuses existing close ownership instead of creating duplicate frontend dirty-state synchronization.
- The guard is fail-closed: visibility, focus or event-delivery failures do not terminate the process.
- No new capability claims or unsupported subscription/platform behavior is introduced.
- Existing direct Rust exit/relaunch implementations remain internal execution primitives and are no longer registered as frontend commands.
- A product contract locks tray routing, command registration, frontend invocation and both existing safe-close event names.

## Changed files

- `src/tauri/src/app_actions.rs`
- `src/tauri/src/main.rs`
- `src/tauri/tests/app_action_contract.rs`
- `src/frontend/src/lib/api.ts`
- `src/frontend/src/features/dashboard-store.ts`
- `src/frontend/src/lib/api.safe-app-actions.test.ts`
- `src/frontend/src/features/dashboard-store-empty-catalog.test.ts`
- `project-tracking/tasks/0044-safe-app-actions-and-empty-profile-catalog.md`
- `project-tracking/reports/0044-safe-app-actions-and-empty-profile-catalog-audit.md`

## Validation evidence

Pending the Windows pull-request workflow on the final branch head.

## Validation boundary

The guard is validated through command contracts, unit/regression tests and the Windows build/package pipeline. A fresh manual interaction matrix against every operating-system timing condition and every real v2rayN/Happ build remains environment-dependent and will not be represented as automated proof.
