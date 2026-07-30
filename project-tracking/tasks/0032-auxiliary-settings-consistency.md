# 0032 - Auxiliary Settings Consistency

## Status

Complete. Exact implementation head `58f71b4718f0d4c0ea034985b1ca22bf8f92c0b5` passed permanent Release Quality #398 (`30588781512`) and PR #25 was squash-merged into `main` as `2f25bc30b5a70497f1a166afa032c37c95d5e32c`.

## Audited baseline

`main` commit `4b1dcc74b2bc558fed27d450d873682231a5ad85`.

## Confirmed findings

1. Happ Setup loaded adapter values but did not apply persisted language, theme, opacity or visual-effect settings and did not react to later settings events.
2. Debug Tools started from browser language/default DOM styling and likewise ignored persisted and live application settings.
3. Full Settings persistence bypassed the serialized live-patch queue, allowing a pending older `apply_ui_settings` request to complete after `update_settings` and roll back one live field.
4. Settings, Happ Setup and Debug Tools could accept a newer `settings-updated` event while their initial `getSettings()` request was pending, then overwrite it with the late stale response.
5. Backend `update_settings` still accepted live UI fields from the full draft payload, so another window's newer language/theme/visibility update could be rolled back even when frontend request ordering was correct.

## Objective

Make all native React surfaces honor one persisted application appearance/language state while preserving unsaved drafts, and make Settings persistence linearizable across live patches and full saves.

## Acceptance criteria

- [x] Happ Setup applies persisted language, theme, opacity and effect settings during load.
- [x] Happ Setup reacts to settings-updated events without discarding an unsaved path/consent draft.
- [x] Clean Happ Setup state follows externally changed Happ path/consent values.
- [x] Debug Tools applies persisted surface settings during load.
- [x] Debug Tools reacts to settings-updated events.
- [x] Full Settings save waits behind all previously queued live UI writes.
- [x] Live UI writes are not enqueued after a full save begins.
- [x] Initial settings loads on all three native settings-aware auxiliary surfaces reject stale responses and stale load errors after a newer event.
- [x] Pending live-patch error recovery completes before a queued full save begins.
- [x] Happ path/consent dirty state is updated synchronously and editable controls are disabled during probe/save.
- [x] Settings controls and close action are disabled while a full save is in progress.
- [x] Backend full-save merge preserves authoritative live UI fields while applying draft-owned fields.
- [x] Regression tests cover auxiliary surfaces, stale initialization and live-patch/full-save ordering.
- [x] Exact-head frontend and Rust Release Quality gates pass.
- [x] PR is squash-merged and final evidence is recorded.

## Final verification evidence

Exact implementation head `58f71b4718f0d4c0ea034985b1ca22bf8f92c0b5` passed Release Quality #398 (`30588781512`) on the dedicated `[self-hosted, v2rayn-widget-ci]` Windows runner.

- workflow contracts and immutable prerequisites: success;
- frontend dependency audit, complete tests and production build: success;
- complete Rust formatting: success;
- Rust suites: 121 unit/integration and 7 product-surface tests, 128 passed and 0 failed;
- strict all-targets Clippy: success;
- strict release/no-default-features Clippy: success;
- locked Rust build: success;
- portable release smoke artifact and diagnostics: success;
- cleanup and aggregate failure gates: clean.

The preceding otherwise-clean run exposed only one canonical rustfmt difference in the new ownership assertion. The exact formatter output was applied and the complete gate was rerun successfully rather than bypassed.

PR #25 was squash-merged into `main` as `2f25bc30b5a70497f1a166afa032c37c95d5e32c`.
