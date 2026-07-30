# 0033 - Tray Runtime Consistency

## Status

Implementation in progress on `audit/0033-tray-runtime-consistency`.

## Audited baseline

`main` commit `cd467b087cdcea13adda28dec4ff290cc23615d7`.

## Confirmed findings

1. Tray labels and tooltip were hardcoded in English even when the persisted application language was Russian, and live language changes never updated the native menu.
2. Tray Refresh committed backend state but did not deliver the returned status to an already open Main webview, leaving it stale until another poll.
3. Tray Refresh and Open Selected Client failures were written only to logs and were invisible to the user.
4. A direct tray status event needed client scoping and freshness ordering so it could not overwrite another selected client or be overwritten by an older in-flight frontend result.

## Objective

Make the native tray a first-class localized product surface with immediate, ordered Main synchronization and visible operation errors.

## Acceptance criteria

- [x] Tray starts with labels and tooltip matching persisted language.
- [x] Successful live language changes update every tray label and tooltip.
- [x] Tray language changes roll back when runtime application or settings persistence fails.
- [x] Tray Refresh emits its exact returned status with selected-client identity.
- [x] Main ignores inactive-client tray status and preserves the freshest backend timestamp.
- [x] Older in-flight frontend refresh results cannot overwrite a newer tray result.
- [x] Tray Refresh and Open Client errors become visible Main notices.
- [x] Pure label tests, frontend ordering tests and product-surface contracts cover the behavior.
- [ ] Exact-head frontend and Rust Release Quality gates pass.
- [ ] PR is squash-merged and final evidence is recorded.
