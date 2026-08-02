# 0043 - Command error boundary and profile catalog resilience

Status: In Progress
Priority: P1

## Problem

The exact merged `main` tree was audited after tasks 0041-0042.

Two reliability gaps remained:

1. Tauri commands expose Rust `Result<_, String>` failures to JavaScript as non-`Error` rejection values. Frontend recovery code primarily reads `Error.message`, so exact backend codes such as `UIPI_MISMATCH` could be replaced with generic fallback text and lose the administrator relaunch action.
2. The generic v2rayN item path did not distinguish a successful empty profile catalog from a transient config read failure. A successful empty catalog must clear stale options, while a temporary read failure for the same installation must preserve the last verified catalog.

## Scope

- Normalize every Tauri command rejection at the shared frontend API boundary.
- Preserve non-empty string and object `message` payloads without changing successful command results.
- Use a stable generic message only when the rejection contains no usable details.
- Make the v2rayN adapter own a path-scoped last-successful profile catalog.
- Update the cache on every successful read, including a successful empty catalog.
- Reuse cached profiles only when a later read fails for the exact same resolved installation path.
- Fail rather than reuse data when no matching verified cache exists.
- Add frontend and Rust regression coverage.

## Acceptance criteria

- `UIPI_MISMATCH` reaches dashboard recovery logic as an `Error` with its exact message.
- The dashboard exposes the existing `relaunch_admin` action for a string rejection from Rust.
- Object-shaped command errors preserve their `message`.
- Unknown rejection values become `Error("Tauri command failed")`.
- A successful empty v2rayN profile read replaces the cached catalog with empty data.
- A transient read failure for the same installation returns the last successful catalog.
- A different installation never receives another path's cached profiles.
- Frontend build/tests and Rust fmt/tests/strict Clippy pass in the repository Windows PR workflow.

## Files

- `src/frontend/src/lib/api.ts`
- `src/frontend/src/lib/api.command-error.test.ts`
- `src/frontend/src/features/dashboard-store-command-error.test.ts`
- `src/tauri/src/adapters/v2rayn.rs`
- `project-tracking/reports/0043-command-error-and-profile-catalog-audit.md`

## Validation

Pending PR workflow evidence.
