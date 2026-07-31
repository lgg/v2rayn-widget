# 0033 - Tray Runtime Consistency Audit Report

## Status

Implementation complete; exact-head verification pending.

## Audit method

The audit treated the Windows tray and native window chrome as declared product surfaces and traced startup settings, live language persistence, menu commands, selected-adapter dispatch, backend status commits, Tauri events, Main store ordering and late Diagnostics creation.

## Confirmed defects

1. **Tray localization drift.** Native labels and tooltip were hardcoded English and never followed persisted or live language.
2. **Successful tray refresh was invisible to Main.** The backend state changed but no event updated the open webview.
3. **Tray failures were log-only.** Refresh and Open Client errors provided no user-visible feedback.
4. **Cross-channel status ordering was undefined.** Native results required selected-client scoping and timestamp freshness against frontend requests.
5. **Native title drift.** Main, Settings, Debug, Happ Setup and Diagnostics titles remained English after a language change.
6. **Related state could split across freshness decisions.** Bootstrap could reject stale status while accepting stale profiles, and tray errors lacked client identity.
7. **Quality verification was bound to a constrained system drive.** Cargo used the checkout workspace on C: until rustc failed with no space despite E: and D: having ample capacity.

## Corrections implemented

- added pure English and Russian native labels with English fallback;
- retained native menu-item and tray handles in managed state;
- localized tray labels, tooltip and every native window title during startup and live language changes;
- localized Diagnostics when its external webview is created after startup;
- integrated native shell language into runtime apply, persistence and rollback;
- added typed client-scoped tray status and operation-error payloads;
- emitted the exact backend Refresh result with the captured selected client;
- ignored inactive-client status and error events;
- preserved the freshest valid backend timestamp across tray and frontend channels;
- accepted bootstrap status and profile pairs atomically;
- reused existing visible notice and UIPI-aware error construction;
- added Rust, frontend and source-contract regression coverage;
- made Release Quality choose the spacious local drive dynamically for an isolated per-run Cargo target;
- copied the release executable to a stable artifact path and removed external/workspace build copies in always-run cleanup;
- extended workflow contracts so storage isolation cannot regress.

## Screen and capability audit

No adapter capability was changed. Tray operations continue to dispatch through the selected adapter and existing backend capability enforcement. Main, Settings, Debug, Happ Setup and Diagnostics now share the same native language state without expanding IPC permissions.

## Verification status

Pending exact-head Release Quality.
