# 0044 - Safe app actions and empty profile catalog

Status: In Progress
Priority: P1

## Problem

A fresh audit of `main` after task 0043 found two remaining reliability gaps.

1. Tray Exit, frontend Exit and administrator relaunch could terminate the process immediately while Settings or Happ Setup contained an unsaved draft. Those surfaces already protected their own native close flow, but destructive application-wide actions bypassed it.
2. Delayed post-route refreshes kept the previous profile list whenever a successful backend result contained zero profiles. After task 0043 made read failure and a verified empty catalog distinct, this length check left stale selector entries visible indefinitely.

## Scope

- Route tray Exit through a draft-aware application action.
- Route frontend Exit and administrator relaunch through draft-aware Tauri commands.
- Reuse the existing safe-close events for Settings and Happ Setup instead of introducing a second dirty-state protocol.
- Execute Exit/Relaunch only after every visible draft-owning surface has hidden successfully.
- Leave a dirty or busy surface visible so its existing confirmation/recovery UX remains authoritative.
- Apply a successful empty profile catalog after delayed toggle and item-selection refreshes.
- Preserve the previous profile catalog only when the status result itself is stale or the list operation fails and the backend supplies its verified fallback.
- Add frontend and Rust regression coverage.

## Acceptance criteria

- Tray Exit cannot discard an unsaved Settings or Happ Setup draft.
- Main, Settings and Debug administrator relaunch actions cannot discard those drafts.
- Clean visible draft surfaces close and allow the requested destructive action to continue.
- Dirty surfaces remain visible with the existing unsaved-change confirmation and block the destructive action.
- Frontend invokes only `request_exit_app` and `request_relaunch_widget_as_admin`.
- Delayed post-route refresh replaces a stale non-empty profile list with a verified empty list.
- Frontend tests/build and Rust fmt/tests/strict Clippy/package smoke pass on Windows CI.

## Files

- `src/tauri/src/app_actions.rs`
- `src/tauri/src/main.rs`
- `src/frontend/src/lib/api.ts`
- `src/frontend/src/features/dashboard-store.ts`
- `src/frontend/src/lib/api.safe-app-actions.test.ts`
- `src/frontend/src/features/dashboard-store-empty-catalog.test.ts`
- `project-tracking/reports/0044-safe-app-actions-and-empty-profile-catalog-audit.md`

## Validation

Pending pull-request workflow evidence.
