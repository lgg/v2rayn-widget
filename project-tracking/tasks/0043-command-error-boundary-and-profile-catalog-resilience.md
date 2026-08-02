# 0043 - Command error boundary and profile catalog resilience

Status: Done
Priority: P1

## Problem

The exact merged `main` tree was audited after tasks 0041-0042.

Three reliability gaps remained:

1. Tauri commands expose Rust `Result<_, String>` failures to JavaScript as non-`Error` rejection values. Frontend recovery code primarily read `Error.message`, so exact backend codes such as `UIPI_MISMATCH` could be replaced with generic fallback text and lose the administrator relaunch action.
2. The generic v2rayN item path did not distinguish a successful empty profile catalog from a transient config read failure. A successful empty catalog must clear stale options, while a temporary read failure for the same installation must preserve the last verified catalog.
3. A queued `open_selected_client` operation could be cancelled correctly by the backend after the selected adapter context changed, but the expected `CLIENT_CONTEXT_CHANGED` cancellation could still surface as an error on the newly selected client.

## Scope completed

- Normalized every Tauri command rejection at the shared frontend API boundary.
- Preserved existing `Error` instances and non-empty string/object `message` payloads.
- Added a stable `Tauri command failed` fallback only for detail-free values.
- Preserved the exact one-argument Tauri invocation contract when no payload exists.
- Treated only `CLIENT_CONTEXT_CHANGED` from `open_selected_client` as an expected stale cancellation; all real launch errors still propagate.
- Made the v2rayN adapter own a path-scoped last-successful profile catalog.
- Updated the cache on every successful read, including a successful empty catalog.
- Reused cached profiles only when a later read failed for the exact same resolved installation path.
- Returned an error when no matching verified cache exists.
- Added frontend and Rust regression coverage.

## Acceptance criteria verified

- `UIPI_MISMATCH` reaches dashboard recovery logic as an `Error` with its exact message.
- The dashboard exposes the existing `relaunch_admin` action for a Rust string rejection.
- Object-shaped command errors preserve their `message`.
- Unknown rejection values become `Error("Tauri command failed")`.
- Argument-free frontend calls still invoke Tauri with exactly one argument.
- A stale client-open cancellation does not leak onto a new adapter context.
- A successful empty v2rayN profile read replaces the cached catalog with empty data.
- A transient read failure for the same installation returns the last successful catalog.
- A different installation never receives another path's cached profiles.
- Frontend build/tests and Rust fmt/tests/strict Clippy pass in the Windows PR workflow.
- A portable Windows release executable is produced and uploaded.

## Files

- `src/frontend/src/lib/api.ts`
- `src/frontend/src/lib/api.command-error.test.ts`
- `src/frontend/src/features/dashboard-store-command-error.test.ts`
- `src/tauri/src/adapters/v2rayn.rs`
- `project-tracking/reports/0043-command-error-and-profile-catalog-audit.md`

## Validation

PR #39 was validated on branch head `12de3ec1dee507b1d43ab3cf0faf8d616d971826` by Release Quality run #513 (`30770443516`):

- frontend dependency audit: passed;
- frontend tests: 111 passed;
- frontend production build: passed;
- Rust formatting: passed;
- Rust tests: 137 passed (127 unit + 9 product-surface contracts + 1 quality-storage contract);
- debug Clippy with `-D warnings`: passed;
- release Clippy with `-D warnings`: passed;
- Rust build/check: passed;
- portable Windows release smoke executable: produced and uploaded, 6,689,921 bytes.

PR #39 merged into `main` as `ff47ac311198afcec86a99ec086beeb743e5269f`.
