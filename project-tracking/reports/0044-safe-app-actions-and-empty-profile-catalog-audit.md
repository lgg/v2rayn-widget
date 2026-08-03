# 0044 - Safe app actions and empty profile catalog audit

Date: 2026-08-03
Baseline: `main` at `ea75ad015f9d56a01b4ead272efcccfe3b15ef55`
Implemented by: PR #41
Merged result: `fe94e0432f0ffef0dd2ee0085c165a62f754d2e9`
Status: Verified and merged

## Repository state reviewed

- Default/product branch: `main`; the repository has no `master` branch.
- Open pull requests at audit start: none.
- Open issues at audit start: none.
- Product branches at audit start: only `main`.
- `beads-backup` remains an intentional archive whose unique content is restricted to `.beads/backup/*`.

## Confirmed findings

### 1. Application-wide destructive actions bypassed draft protection

Settings and Happ Setup already owned native close requests and displayed an unsaved-change confirmation. However, tray Exit, frontend Exit and administrator relaunch called `app.exit(0)` through paths that did not ask those surfaces to close first. A user could therefore lose an unsaved draft by choosing Exit from the tray or relaunching with administrator privileges from Main, Settings or Debug.

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

## CI-discovered issue

An intermediate run passed all code tests, lint checks, builds and portable packaging, but the aggregate job remained red because `cargo fmt --check` rejected one multiline `assert!` layout in the new static contract. The file was changed to the exact rustfmt output and the complete pipeline was rerun on final branch head `5911a4fe24798d39ef9c6f995f61d7ca7b3b67a9`. Final run #519 passed every step.

## Review observations

- The change reuses existing close ownership instead of creating duplicate frontend dirty-state synchronization.
- The guard is fail-closed: visibility, focus or event-delivery failures do not terminate the process.
- No new capability claims or unsupported subscription/platform behavior is introduced.
- Existing direct Rust exit/relaunch implementations remain internal execution primitives and are no longer registered as frontend commands.
- A product contract locks tray routing, command registration, frontend invocation and both existing safe-close event names.
- Repository review found no additional confirmed defect requiring a change in this pass.

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

Release Quality run #519 (`30804545173`) validated PR #41 final branch head `5911a4fe24798d39ef9c6f995f61d7ca7b3b67a9` on the repository's self-hosted Windows x64 runner:

- workflow, credentials, action pinning, installer and cleanup contracts: passed;
- frontend dependency audit: 0 vulnerabilities at the configured severity threshold;
- frontend tests: 115 passed across 31 files;
- frontend production build: passed;
- frontend distribution and diagnostics artifacts: uploaded;
- Rust formatting: passed;
- Rust tests: 140 passed (129 unit + 1 app-action contract + 9 product-surface contracts + 1 quality-storage contract);
- debug Clippy with `-D warnings`: passed;
- release Clippy with `-D warnings`: passed;
- Rust build/check: passed;
- portable `v2rayn-widget.exe` release smoke artifact: built and uploaded;
- portable artifact archive size: 6,715,342 bytes;
- portable artifact archive SHA-256 digest: `7c689c6d76420890ce97ff3278d454caeb533df4663bb47b81ad630ac976f2fd`;
- Rust diagnostics artifact SHA-256 digest: `6e384213b3b60749363f507e563a1da6333ecfca3df9ecdc38611f4ca8a0085c`.

## Validation boundary

The guard is validated through command contracts, unit/regression tests and the Windows build/package pipeline. This does not claim a fresh manual interaction matrix against every operating-system timing condition or every real v2rayN/Happ build. Those external-client and timing combinations remain environment-dependent and are not represented as automated proof.
