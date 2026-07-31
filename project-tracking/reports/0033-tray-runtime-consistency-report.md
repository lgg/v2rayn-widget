# 0033 - Tray Runtime Consistency Audit Report

## Status

Complete. Implementation PR #27 was squash-merged into `main` as `13bb2657f01e03b9e530290bedbd10683a53f63d` after exact-head Release Quality passed.

## Audit method

The audit treated the Windows tray and native window chrome as declared product surfaces and traced startup settings, live language persistence, menu commands, selected-adapter dispatch, backend status commits, Tauri events, Main store ordering, late Diagnostics creation and the reliability of the permanent Windows validation pipeline.

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
- added Rust, frontend and product-surface regression coverage;
- made Release Quality dynamically choose the spacious local drive for an isolated per-run Cargo target;
- copied the release executable to a stable artifact path and removed external/workspace build copies in always-run cleanup;
- added workflow and Rust storage contracts so the constrained-system-drive failure cannot silently regress.

## Screen and capability audit

No adapter capability was changed. Tray operations continue to dispatch through the selected adapter and existing backend capability enforcement. Main, Settings, Debug, Happ Setup and Diagnostics now share the same native language state without expanding command registration, settings schema or IPC permissions. The external Diagnostics webview remains outside the default Tauri IPC capability.

## Verification evidence

Implementation head `8276a83f7090cf89d6c87289d941de2725fcc7fe` passed permanent Release Quality #419, run `30625480840`.

- workflow, security, installer-boundary and immutable-toolchain contracts: success;
- frontend dependency audit, complete tests and production build: success;
- complete Rust formatting: success;
- 123 unit/integration tests: passed;
- 8 product-surface tests: passed;
- 1 quality-storage contract: passed;
- total: 132 passed, 0 failed;
- strict all-targets Clippy: success;
- strict release/no-default-features Clippy: success;
- locked Rust build: success;
- portable release smoke artifact: success;
- diagnostics artifacts: success;
- isolated target selected on `E:` with 2779.62 GB free;
- external target and stable workspace artifact copy were both removed by cleanup;
- aggregate failure gates: clean.

## Merge evidence

PR #27, `0033: localize native shell and synchronize tray results`, was squash-merged into `main` as `13bb2657f01e03b9e530290bedbd10683a53f63d`.

## Residual limits

- Native localization currently intentionally covers the repository-supported English and Russian locales; unknown locales fall back to English.
- Actual Windows tray rendering remains operating-system-controlled, while labels, titles, event payloads, ordering, persistence and rollback are repository-tested.
- Happ UI Automation remains experimental and version-sensitive as documented by the preceding audits; task 0033 did not broaden that capability.
