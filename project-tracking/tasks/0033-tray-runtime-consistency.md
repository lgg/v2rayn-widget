# 0033 - Tray Runtime Consistency

## Status

Complete. Implementation PR #27 was squash-merged into `main` as `13bb2657f01e03b9e530290bedbd10683a53f63d`.

## Audited baseline

`main` commit `cd467b087cdcea13adda28dec4ff290cc23615d7`.

## Confirmed findings

1. Tray labels and tooltip were hardcoded in English even when the persisted application language was Russian, and live language changes never updated the native menu.
2. Tray Refresh committed backend state but did not deliver the returned status to an already open Main webview, leaving it stale until another poll.
3. Tray Refresh and Open Selected Client failures were written only to logs and were invisible to the user.
4. Direct tray results needed selected-client scoping and freshness ordering so they could not cross client contexts or be overwritten by older frontend requests.
5. Native titles for Main, Settings, Debug, Happ Setup and late-created Diagnostics remained hardcoded in English.
6. The freshness layer could reject a stale bootstrap status while still accepting its stale profile list; status/profile pairs and tray errors needed atomic client-scoped acceptance.
7. Release Quality compiled every Rust phase inside the checkout workspace on the nearly full system drive even though spacious local drives were available, causing an infrastructure-only no-space failure before final verification.

## Objective

Make the complete native shell localized and make tray status, profile and error delivery ordered, atomic and scoped to the active adapter.

## Acceptance criteria

- [x] Tray starts with labels and tooltip matching persisted language.
- [x] Successful live language changes update every tray label and tooltip.
- [x] Native window titles follow persisted and live language, including late Diagnostics creation.
- [x] Tray language and native titles roll back when runtime application or settings persistence fails.
- [x] Tray Refresh emits its exact returned status with selected-client identity.
- [x] Main ignores inactive-client tray status and preserves the freshest backend timestamp.
- [x] Older in-flight frontend results cannot overwrite a newer tray result.
- [x] Tray Refresh and Open Client errors become visible only for the active client.
- [x] Bootstrap accepts or rejects status and profiles atomically.
- [x] Pure native-label tests, frontend ordering tests and product-surface contracts cover the behavior.
- [x] Release Quality selects an isolated spacious-drive Cargo target, publishes from a stable workspace path and removes both copies during cleanup.
- [x] Exact-head frontend and Rust Release Quality gates pass.
- [x] PR is squash-merged and final evidence is recorded.

## Exact-head verification

Implementation head `8276a83f7090cf89d6c87289d941de2725fcc7fe` passed permanent Release Quality #419, run `30625480840`.

- workflow, security, installer-boundary and immutable-toolchain contracts: success;
- frontend dependency audit, complete tests and production build: success;
- complete Rust formatting: success;
- Rust suites: 123 unit/integration + 8 product-surface + 1 storage contract = 132 passed, 0 failed;
- strict all-targets Clippy: success;
- strict release/no-default-features Clippy: success;
- locked Rust build: success;
- portable release smoke artifact and diagnostics: success;
- isolated Rust target: `E:\github-ci-targets\v2rayn-widget\30625480840-1`, selected with 2779.62 GB free;
- external Cargo target and workspace portable copy cleanup: success;
- aggregate failure gates: clean.

## Merge evidence

PR #27, `0033: localize native shell and synchronize tray results`, was squash-merged into `main` as `13bb2657f01e03b9e530290bedbd10683a53f63d`.
