# 0031 - Happ Toggle Lifecycle Audit Report

## Status

Implementation complete. Exact-head verification and merge remain pending.

## Audited baseline

`main` commit `7016c29319fe6bdd502dcea835c0e336f0758d22`.

## Audit method

The review rechecked all declared Main, Settings, Happ Setup, Debug Tools and external Diagnostics surfaces, then followed each visible action through frontend capability gating, Tauri command registration, selected-adapter dispatch, operation serialization, Windows process/window scoping, UI Automation classification, state ownership and error reporting.

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

## Verification status

Pending on the final exact PR head:

- frontend dependency audit;
- complete frontend tests;
- production frontend build;
- complete Rust formatting;
- all Rust unit/integration tests;
- strict all-targets Clippy;
- strict release/no-default-features Clippy;
- locked Rust check;
- portable Windows release smoke build;
- artifact and diagnostics upload;
- cleanup and aggregate failure gates.

## Residual limits

- Happ UI Automation remains inherently version-sensitive and experimental.
- The readiness and confirmation windows are bounded to five seconds each; a severely overloaded desktop may still return an explicit timeout rather than click ambiguously or indefinitely.
- Real-machine validation across multiple Happ versions and Windows/RDP sessions remains empirical compatibility work, not a repository-controlled missing implementation.

## Redaction review

Complete. No private paths, endpoint values, subscription contents, credentials, window text or unredacted UI Automation node data were introduced.
