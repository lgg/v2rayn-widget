# 0031 - Happ Toggle Lifecycle Audit Report

## Status

Complete. Exact implementation head `bd0ac91787f90a2cc74495c980b65a47f49e865b` passed permanent Release Quality #377 (`30155372429`) and PR #23 was squash-merged into `main` as `f2ccc95ec3f457706c762e74f344b7e29b5b2e5d`.

## Audited baseline

`main` commit `7016c29319fe6bdd502dcea835c0e336f0758d22`.

## Audit method

The review rechecked all declared Main, Settings, Happ Setup, Debug Tools and external Diagnostics surfaces, then followed each action through frontend capability gating, Tauri command registration, selected-adapter dispatch, operation serialization, Windows process/window scoping, UI Automation classification, state ownership and error reporting.

The new findings were isolated to the experimental Happ control lifecycle. No unsupported or research-required capability was promoted.

## Confirmed defects

1. **Premature minimized-state restoration.** `happ_ui::toggle_connection` restored Happ for the click but immediately minimized it again before `happ::toggle` started confirmation. A successful click could therefore be followed by an off-screen probe and a false `HAPP_TOGGLE_UNCONFIRMED` result.
2. **Process-ready was treated as UI-ready.** After launching Happ, the adapter waited for a process only and attempted control once. The process can be visible before the main window and a unique high-confidence action are ready.
3. **Read and click visibility had one overly strict rule.** Read-only status inference rejected an exact enabled action whenever UI Automation marked it off-screen, including the normal minimized-window case. Clicks correctly require onscreen interaction, but reads do not need to mutate the control.

## Corrections implemented

- added a bounded pre-click readiness phase that polls for a unique high-confidence action after process detection;
- preserved the single-click invariant: retries occur only before the click or as read-only confirmation afterward;
- split read and click visibility semantics;
- read probes accept an exact enabled action off-screen only when the top-level Happ window itself is minimized;
- normal-window hidden actions remain excluded;
- the click scan always requires an enabled onscreen candidate;
- successful clicks retain whether the window was originally minimized;
- the window remains restored through expected-state confirmation;
- the original minimized state is restored after success or failure;
- action-identification failures restore immediately;
- post-click confirmation performs a fast local refresh without external IP or latency blocking;
- restoration errors are surfaced in the final event/error instead of being silently discarded.

## Regression coverage

Rust unit tests verify:

- read probes may accept exact off-screen actions;
- click scans reject off-screen actions;
- disabled candidates remain rejected;
- readiness requires a window, action label and score at or above the existing confidence threshold.

A permanent product-surface contract verifies:

- confirmation is declared before minimized-state restoration in the adapter lifecycle;
- the post-click refresh is local-only;
- the controller returns the original minimized-state flag;
- the click scan remains onscreen-only;
- off-screen read behavior is conditioned on the top-level window being minimized.

## Screen and capability audit result

No additional missing screen or inflated capability claim was found:

- Main remains selected-adapter and capability gated;
- Settings remains the owner of general and v2rayN fields;
- Happ Setup remains the owner of Happ path, consent and probe compatibility;
- Debug Tools remains explicitly v2rayN-specific;
- Diagnostics remains an external webview without default Tauri IPC capability;
- v2rayN subscriptions and generic transport remain unsupported;
- Happ profiles, restart and subscriptions remain research-required;
- Happ control remains explicit opt-in, PID-scoped, exact-label, confidence-gated, unique-candidate and fail-closed.

## Files changed

- `src/tauri/src/adapters/happ.rs`
- `src/tauri/src/services/happ_ui.rs`
- `src/tauri/tests/product_surface_contracts.rs`
- `docs/architecture.md`
- task/report 0031.

## Final verification and merge evidence

Exact implementation head `bd0ac91787f90a2cc74495c980b65a47f49e865b` passed permanent Release Quality #377 (`30155372429`) on the dedicated `[self-hosted, v2rayn-widget-ci]` Windows runner.

- workflow contracts and immutable prerequisites: success;
- frontend dependency audit: success;
- complete frontend tests: success;
- production frontend build: success;
- complete Rust formatting: success;
- Rust suites: 120 unit/integration and 7 product-surface tests, 127 passed and 0 failed;
- strict all-targets Clippy: success;
- strict release/no-default-features Clippy: success;
- locked Rust check: success;
- portable Windows release smoke build: success;
- frontend and Rust artifact/diagnostics upload: success;
- cleanup and aggregate failure gates: success.

The first otherwise-clean permanent run exposed only three canonical Rust formatting differences. The exact rustfmt output was applied and the complete exact-head gate was rerun successfully rather than bypassed.

PR #23 was squash-merged into `main` as `f2ccc95ec3f457706c762e74f344b7e29b5b2e5d`.

## Residual limits

- Happ UI Automation remains inherently version-sensitive and experimental.
- The readiness and confirmation windows are bounded to five seconds each; a severely overloaded desktop may still return an explicit timeout rather than click ambiguously or indefinitely.
- Real-machine validation across multiple Happ versions and Windows/RDP sessions remains empirical compatibility work, not a repository-controlled missing implementation.

## Redaction review

Complete. No private paths, endpoint values, subscription contents, credentials, window text or unredacted UI Automation node data were introduced.

## Completion

Task 0031 is complete. No repository-controlled implementation, capability claim, screen, lifecycle or documentation item identified by this audit remains open. Future work is limited to explicitly experimental client-version and desktop-session compatibility testing.
