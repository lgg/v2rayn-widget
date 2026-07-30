# 0032 - Auxiliary Settings Consistency

## Status

Implementation in progress on `audit/0032-auxiliary-settings-consistency`.

## Audited baseline

`main` commit `4b1dcc74b2bc558fed27d450d873682231a5ad85`.

## Confirmed findings

1. Happ Setup loaded adapter values but did not apply persisted language, theme, opacity or visual-effect settings and did not react to later settings events.
2. Debug Tools started from browser language/default DOM styling and likewise ignored persisted and live application settings.
3. Full Settings persistence bypassed the serialized live-patch queue, allowing a pending older `apply_ui_settings` request to complete after `update_settings` and roll back one live field.
4. Settings, Happ Setup and Debug Tools could accept a newer `settings-updated` event while their initial `getSettings()` request was pending, then overwrite it with the late stale response.

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
- [x] Regression tests cover auxiliary surfaces, stale initialization and live-patch/full-save ordering.
- [ ] Exact-head frontend and Rust Release Quality gates pass.
- [ ] PR is squash-merged and final evidence is recorded.
