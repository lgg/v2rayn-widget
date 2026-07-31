# 0034 - Async and Native Consistency Audit Report

## Status

Complete. Implementation PR #29 was squash-merged into `main` after final exact-head Release Quality passed.

## Audit method

The audit traced native tray dispatch, selected-client epochs, backend event ownership, frontend listener registration, startup bootstrap replacement, timestamp precision, auxiliary loading/save races, React test scheduling and Windows runner storage/cleanup behavior.

## Confirmed defects corrected

- tray result identity could diverge from the adapter actually dispatched;
- JavaScript millisecond parsing discarded Chrono nanosecond ordering;
- authoritative listeners had a registration gap before initial requests;
- an initial settings event could cancel bootstrap without replacement operational refresh;
- authoritative settings events could leave Settings or Happ Setup loading;
- the Unknown placeholder could appear newer than real backend status;
- a stale failed live write could show a false settings-save error;
- Release Quality could choose non-fixed storage and silently leave generated paths;
- auxiliary tests emitted React `act` warnings and a source contract depended on line wrapping.

## Corrections implemented

- backend-owned tray operation envelopes capture client and epoch once;
- stale tray results/errors are suppressed instead of mislabeled;
- frontend compares full RFC3339 nanosecond instants and treats placeholder status as oldest;
- Main registers all authoritative listeners before bootstrap;
- Settings, Happ Setup and Debug register settings listeners before initial loads;
- an initial settings event starts an authoritative startup status/profile refresh;
- Settings and Happ Setup leave loading on authoritative events;
- stale live-save failures are revision-gated;
- Release Quality selects only ready fixed drives and verifies every cleanup path;
- auxiliary listener-ready and teardown transitions are flushed within React `act`;
- frontend CI fails on React `act` warnings;
- source contracts validate semantic listener registration across formatter layouts.

## Screen, capability and security audit

No adapter capability was broadened. Generic tray operations still dispatch through the selected adapter and backend capability enforcement. No settings schema, Tauri command registration or diagnostics IPC permission was expanded. The external Diagnostics webview remains outside the default IPC capability.

## Verification evidence

Implementation head `0bbfc96d8dd1961f9be5d45e124e34e5522df489` passed permanent Release Quality #450, run `30632727422`.

- workflow/security/toolchain contracts: success;
- frontend dependency audit: success;
- 20 frontend test files: passed;
- 84 frontend tests: passed;
- React `act` warning scan: clean;
- frontend production build: success;
- complete Rust formatting: success;
- 123 Rust unit/integration tests: passed;
- 9 product-surface contracts: passed;
- 1 quality-storage contract: passed;
- total Rust tests: 133 passed, 0 failed;
- strict all-targets Clippy: success;
- strict release/no-default-features Clippy: success;
- locked Rust build: success;
- portable release smoke artifact and diagnostics: success;
- ready fixed-drive target selection: success;
- workspace and external Cargo target cleanup verification: success;
- aggregate failure gates: clean.

## Merge evidence

PR #29, `0034: harden async native consistency`, was squash-merged into `main` as `4276f04e085f4bccb4d0d956266a9b13cd56c873`.

## Residual limits

- Native event delivery remains process-local; a terminated application cannot receive events, while persisted backend state is recovered on the next startup bootstrap.
- Unknown locales continue to fall back to English by design.
- Happ UI Automation remains experimental and version-sensitive; this audit did not broaden it.
