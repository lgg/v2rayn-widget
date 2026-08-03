# 0044 - Safe app actions and empty profile catalog

Status: Done
Priority: P1

## Problem

A fresh audit of `main` after tasks 0041-0043 found two remaining reliability gaps.

1. Tray Exit, frontend Exit and administrator relaunch could terminate the process immediately while Settings or Happ Setup contained an unsaved draft. Those surfaces already protected their own native close flow, but destructive application-wide actions bypassed it.
2. Delayed post-route refreshes kept the previous profile list whenever a successful backend result contained zero profiles. After task 0043 made read failure and a verified empty catalog distinct, this length check left stale selector entries visible indefinitely.

## Scope completed

- Routed tray Exit through a draft-aware application action.
- Routed frontend Exit and administrator relaunch through draft-aware Tauri commands.
- Reused the existing safe-close events for Settings and Happ Setup instead of introducing a second dirty-state protocol.
- Allowed Exit/Relaunch only after every visible draft-owning surface hid successfully.
- Kept dirty or busy surfaces visible so their existing confirmation/recovery UX remains authoritative.
- Applied successful empty profile catalogs after delayed toggle and item-selection refreshes.
- Preserved the previous profile catalog only when the corresponding status result is stale; actual read failure remains owned by the adapter's verified fallback.
- Added frontend, Rust unit and product-contract regression coverage.

## Acceptance criteria verified

- Tray Exit cannot discard an unsaved Settings or Happ Setup draft.
- Main, Settings and Debug administrator relaunch actions cannot discard those drafts.
- Clean visible draft surfaces close and allow the requested destructive action to continue.
- Dirty/busy surfaces remain visible with the existing unsaved-change confirmation and block the destructive action.
- Frontend invokes only `request_exit_app` and `request_relaunch_widget_as_admin`.
- Product contracts prevent tray/handler/frontend routing from reverting to direct destructive commands.
- Delayed post-route refresh replaces a stale non-empty profile list with a verified empty list.
- Frontend tests/build and Rust fmt/tests/strict Clippy/package smoke pass on Windows CI.

## Files

- `src/tauri/src/app_actions.rs`
- `src/tauri/src/main.rs`
- `src/tauri/tests/app_action_contract.rs`
- `src/frontend/src/lib/api.ts`
- `src/frontend/src/features/dashboard-store.ts`
- `src/frontend/src/lib/api.safe-app-actions.test.ts`
- `src/frontend/src/features/dashboard-store-empty-catalog.test.ts`
- `project-tracking/reports/0044-safe-app-actions-and-empty-profile-catalog-audit.md`

## Validation

PR #41 was validated on final branch head `5911a4fe24798d39ef9c6f995f61d7ca7b3b67a9` by Release Quality run #519 (`30804545173`):

- frontend dependency audit: 0 high-severity vulnerabilities;
- frontend tests: 115 passed across 31 files;
- frontend production build: passed;
- Rust formatting: passed;
- Rust tests: 140 passed (129 unit + 1 app-action contract + 9 product-surface contracts + 1 quality-storage contract);
- debug Clippy with `-D warnings`: passed;
- release Clippy with `-D warnings`: passed;
- Rust build/check: passed;
- portable Windows release smoke executable: produced and uploaded, 6,715,342 bytes.

PR #41 merged into `main` as `fe94e0432f0ffef0dd2ee0085c165a62f754d2e9`.
