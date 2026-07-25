# 0031 - Happ Toggle Lifecycle Hardening

## Status

Complete. Exact implementation head `bd0ac91787f90a2cc74495c980b65a47f49e865b` passed permanent Release Quality #377 (`30155372429`) and PR #23 was squash-merged into `main` as `f2ccc95ec3f457706c762e74f344b7e29b5b2e5d`.

## Audited baseline

`main` commit `7016c29319fe6bdd502dcea835c0e336f0758d22`.

## Context

A fourth independent product-surface audit traced the experimental Happ Connect/Disconnect path from Main capability gating through process startup, Windows UI Automation discovery, window restoration, the single click, state confirmation, local refresh and original window-state restoration.

The feature was present and fail-closed at identification time, but its runtime lifecycle could still report false failures for a minimized or freshly launched Happ instance.

## Confirmed findings

1. A minimized Happ window was restored for the click and minimized again before post-click confirmation. Because the probe required an onscreen control, a successful click could be reported as `HAPP_TOGGLE_UNCONFIRMED`.
2. A cold-start toggle waited only for the process. The process could exist before the application window and a unique high-confidence Connect/Disconnect action were ready, producing a false immediate control failure.
3. A read-only probe rejected an exact enabled action solely because the top-level Happ window was minimized, degrading experimental connection status to Unknown even though no click was being attempted.

## Objective

Make Happ experimental control a single, deterministic lifecycle:

1. detect or launch the configured process;
2. wait for a unique high-confidence action;
3. restore a minimized window;
4. require an onscreen enabled action for the click;
5. click exactly once;
6. confirm the expected state while the window remains available;
7. perform a fast local refresh;
8. restore the original minimized state on success or failure.

## In scope

- Happ cold-start readiness;
- minimized-window read and click semantics;
- post-click confirmation ordering;
- original minimized-state restoration;
- fast local status refresh after control;
- permanent Rust and source-contract regression coverage;
- architecture documentation;
- full exact-head Windows Release Quality verification.

## Out of scope

- promoting Happ UI Automation from experimental to supported;
- adding Happ profile, restart or subscription operations;
- changing action label allowlists or confidence thresholds;
- writing Happ configuration or subscription storage;
- broadening default Tauri capabilities.

## Acceptance criteria

- [x] Cold-start control waits for a unique high-confidence action after process detection.
- [x] Read-only probes can classify an exact enabled action when the top-level Happ window is minimized.
- [x] Hidden/off-screen actions in a normal, non-minimized window remain rejected.
- [x] The click path always requires an enabled onscreen action.
- [x] A successful click is confirmed before the original minimized state is restored.
- [x] Click-identification failures restore the original minimized state immediately.
- [x] Confirmation failures restore the original minimized state before returning.
- [x] Post-action status refresh avoids blocking on external IP and latency requests.
- [x] Pure readiness/visibility tests and a source-order lifecycle contract are present.
- [x] Frontend audit, tests and production build pass on the exact PR head.
- [x] Rust formatting, all tests, both strict Clippy passes, locked check and portable build pass on the exact PR head.
- [x] Artifact, diagnostics, cleanup and aggregate gates pass.
- [x] PR is squash-merged into `main` and final evidence is recorded.

## Final verification evidence

Exact implementation head `bd0ac91787f90a2cc74495c980b65a47f49e865b` passed Release Quality #377 (`30155372429`) on the dedicated `[self-hosted, v2rayn-widget-ci]` Windows runner.

- workflow contracts and immutable prerequisites: success;
- frontend dependency audit, complete tests and production build: success;
- complete Rust formatting: success;
- Rust suites: 120 unit/integration and 7 product-surface tests, 127 passed and 0 failed;
- strict all-targets Clippy: success;
- strict release/no-default-features Clippy: success;
- locked Rust build: success;
- portable release smoke artifact and diagnostics: success;
- cleanup and aggregate failure gates: clean.

The preceding otherwise-clean run exposed only three canonical rustfmt differences. The exact formatter output was applied and the complete gate was rerun successfully rather than bypassed.

PR #23 was squash-merged into `main` as `f2ccc95ec3f457706c762e74f344b7e29b5b2e5d`.

## Safety decisions

- Read-only minimized-window classification still requires an exact allowlisted label, clickable control type, enabled state, unique candidate and minimum confidence.
- A normal non-minimized window still requires the candidate to be onscreen, preventing hidden controls from being promoted.
- The click scan is stricter than the read scan and always requires onscreen interaction.
- No retry may perform a second click. Readiness polling occurs before the single click; confirmation polling is read-only.
- Restoration failure is surfaced without hiding the successful or failed action result.

## Residual limits

- Happ UI Automation remains version-sensitive and experimental.
- Readiness and confirmation are each bounded to five seconds and fail explicitly rather than click ambiguously or wait indefinitely.
- Multi-version Happ and Windows/RDP validation remains empirical compatibility work rather than a repository-controlled missing implementation.

## Related report

`project-tracking/reports/0031-happ-toggle-lifecycle-report.md`
