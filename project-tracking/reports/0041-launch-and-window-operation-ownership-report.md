# 0041 - Launch and Window Operation Ownership Report

## Status

Complete. The verified PR merge candidate passed Release Quality and the implementation was squash-merged into `main`.

## Audit coverage

- Main window dynamic sizing.
- Diagnostics dynamic-window opening.
- Main/Tray selected-client open paths.
- Happ executable detection, exact-process matching and startup lifecycle.
- Shared Happ operation serialization.
- Selected-client context invalidation.
- Existing frontend and Windows Rust release gates.

## Confirmed findings

1. Happ open returned immediately after `spawn()`, releasing the adapter lock before the exact process became observable. A queued open could therefore start a duplicate instance.
2. Auto-path mode could observe an unrelated Happ process unless startup confirmation was scoped to the executable selected for this launch.
3. Diagnostics open had no synchronous frontend ownership, allowing duplicate dynamic-window creation requests before the first invoke settled.
4. Main height invokes were independent promises, allowing an older native resize to complete after a newer measurement.

## Implemented corrections

- Resolve and retain the exact Happ executable selected before launch.
- Keep the shared Happ operation lock while polling for that executable's process.
- Stop the poll when selected-client context becomes stale.
- Return an explicit `HAPP_START_TIMEOUT` error when the exact process does not appear.
- Add deterministic polling helper tests for delayed readiness and timeout.
- Coalesce duplicate Diagnostics open calls into one shared in-flight promise.
- Release Diagnostics ownership in `finally`, permitting a later retry after success or failure.
- Chain Main height writes through a failure-tolerant promise tail so native writes preserve measurement order.
- Add frontend tests for duplicate Diagnostics calls, ordered height writes and post-failure recovery.

## Verification evidence

- Verified source head: `de903b606c0c07f455f8998e82085964e7b08b89`.
- Verified PR merge candidate: `1dde9fdeec83855ee695939ff246b0d2a0fff353` against base `0c172d87868d8fbe5c4d96b77ff975ce376b4811`.
- Release Quality run `#508`: successful.
- Workflow and installer contracts passed; npm audit found zero vulnerabilities.
- Frontend: 27 test files and 107 tests passed without React act warnings; TypeScript/Vite production build passed.
- Rust Windows: rustfmt and all 136 Rust tests passed; strict normal/release Clippy checks and locked build passed.
- Portable Windows executable smoke artifact was built and uploaded successfully.
- Pull request `#37` was squash-merged into `main` as `5d06a9ab3b348b5dbfb460e987cbca9fdc02ea1a`.

## Files changed

- `src/tauri/src/adapters/mod.rs`
- `src/frontend/src/lib/api.ts`
- `src/frontend/src/lib/api.operation-ownership.test.ts`
- task/report 0041

## Residual limitations

No adapter capability claims changed. Subscription operations remain unsupported, Linux/macOS remain deferred, and Happ connection control remains experimental and opt-in.

## Public redaction review

Passed. Added tests and tracking contain no credentials, subscription URLs, private endpoints, local user paths, runtime logs or personal data.
