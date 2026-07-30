# 0033 - Tray Runtime Consistency Audit Report

## Status

Implementation in progress.

## Audit method

The audit treated the Windows tray as a declared native product surface and traced startup settings, live language persistence, menu commands, selected-adapter dispatch, backend status commits, Tauri events and Main store ordering.

## Confirmed defects

1. **Tray localization drift.** Native labels and tooltip were hardcoded English and never followed persisted/live language.
2. **Successful tray refresh was invisible to Main.** The backend state changed but no event updated the open webview.
3. **Tray failures were log-only.** Refresh/Open Client errors provided no user-visible feedback.
4. **Cross-channel status ordering was undefined.** A native result required selected-client scoping and timestamp freshness against frontend requests.

## Corrections implemented

- added pure English/Russian tray labels with English fallback;
- retained native menu item and tray handles in managed state;
- integrated tray language into runtime apply/persist/rollback;
- added typed tray status and operation-error payloads;
- emitted the exact backend Refresh result with the captured selected client;
- added Main listeners and store handlers;
- ignored inactive-client events;
- preserved the freshest valid backend timestamp across tray/frontend channels;
- reused existing visible notice and UIPI-aware error construction;
- added Rust, frontend and source-contract regression coverage.

## Screen and capability audit

No adapter capability was changed. Tray operations continue to dispatch through the selected adapter and existing backend capability enforcement. The work changes only localization, event delivery, ordering and error visibility.

## Verification status

Pending exact-head Release Quality.
