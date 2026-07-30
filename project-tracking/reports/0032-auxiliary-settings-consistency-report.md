# 0032 - Auxiliary Settings Consistency Audit Report

## Status

Complete. Exact implementation head `58f71b4718f0d4c0ea034985b1ca22bf8f92c0b5` passed permanent Release Quality #398 (`30588781512`) and the implementation was squash-merged through PR #25 as `2f25bc30b5a70497f1a166afa032c37c95d5e32c`.

## Audit method

The audit rechecked Main, Settings, Happ Setup, Debug Tools and Diagnostics from rendered controls through settings ownership, asynchronous persistence, Tauri events and backend commands. It specifically compared the documented application-wide language/visual settings with the initialization and update behavior of every native React webview.

## Confirmed defects

1. **Happ Setup appearance/language drift.** The window fetched settings only to populate Happ fields; it never applied persisted theme/language/opacity/effect values and did not subscribe to settings updates.
2. **Debug Tools appearance/language drift.** The screen did not fetch application settings at all and remained on browser-language/default DOM styling.
3. **Non-linearizable Settings save.** Live UI patches were serialized with each other, but the full save bypassed that queue. A slower older patch could therefore persist after the full save and roll back one field.
4. **Stale initialization could beat a newer event.** Settings, Happ Setup and Debug Tools had no request revision guard around their initial settings fetch, so a late old response could overwrite a newer `settings-updated` event.
5. **Backend ownership still allowed stale live-field rollback.** The full-save merge preserved adapter/window fields but still copied live UI fields from the draft payload instead of authoritative backend state.

## Corrections implemented

- added a shared auxiliary-surface settings applicator for language, theme, opacity and visual effects;
- applied it during Happ Setup and Debug Tools initialization;
- subscribed both auxiliary surfaces to `settings-updated` events;
- preserved Happ Setup local path/consent input while a draft is dirty;
- synchronized clean Happ Setup input to authoritative external changes;
- queued the complete live-patch workflow, including failure recovery, and placed the full Settings save behind it;
- blocked new live-patch submission and form edits after the full save starts;
- updated Happ dirty state synchronously and disabled path edits during probe/save;
- added settings-event revision guards to all three affected initial loads;
- rebased every live UI field from authoritative backend state during full-save merge while retaining draft-owned general/v2rayN fields;
- added a Rust ownership regression test for stale live fields versus fresh draft fields;
- added regression coverage for persisted/live auxiliary settings, stale initialization and save ordering.

## Screen and capability audit

No capability state was promoted or broadened. Main remains selected-adapter/capability gated; Settings remains the owner of general and v2rayN fields; Happ Setup remains the owner of Happ path and explicit consent; Debug Tools remains v2rayN-specific; Diagnostics remains an external webview without default Tauri IPC capability.

## Exact-head verification

Exact implementation head `58f71b4718f0d4c0ea034985b1ca22bf8f92c0b5` passed permanent Release Quality #398 (`30588781512`).

- workflow contracts and immutable prerequisites: success;
- frontend dependency audit, complete tests and production build: success;
- complete Rust formatting: success;
- Rust suites: 121 unit/integration plus 7 product-surface tests, 128 passed and 0 failed;
- strict all-targets Clippy: success;
- strict release/no-default-features Clippy: success;
- locked Rust build: success;
- portable release smoke artifact and diagnostics: success;
- cleanup and aggregate failure gates: clean.

The first otherwise-clean exact-head run exposed only one canonical rustfmt difference in the new ownership assertion. The exact formatter output was applied and the complete gate was rerun successfully rather than bypassed.

## Merge evidence

PR #25 was squash-merged into `main` as `2f25bc30b5a70497f1a166afa032c37c95d5e32c`.

## Residual limits

No repository-controlled auxiliary settings inconsistency remains from this audit. Runtime behavior still depends on the normal Tauri event loop and operating-system window delivery, but stale-response and stale-payload paths now fail closed through revision guards and authoritative ownership rules.
