# 0041 - Launch and Window Operation Ownership Report

## Status

Implementation complete; merge-candidate verification pending.

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

Pending full Release Quality on the current PR merge candidate.

## Residual limitations

Subscription operations remain unsupported. Linux/macOS remain deferred. Happ connection control remains experimental and opt-in. This audit does not change adapter capability claims.

## Public redaction review

Passed. Added tests and tracking contain no credentials, subscription URLs, private endpoints, local user paths, runtime logs or personal data.
