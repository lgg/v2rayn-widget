# 0041 - Launch and Window Operation Ownership

## Metadata

| Field | Value |
| --- | --- |
| Status | In Progress |
| Priority | P1 |
| Type | audit/hardening |
| Base | `0c172d87868d8fbe5c4d96b77ff975ce376b4811` |
| Public redaction | Reviewed |

## Context

A fresh independent audit of the merged `main` tree found three remaining asynchronous ownership gaps:

1. Happ open held the shared adapter lock only through `Command::spawn()`. A queued Main or Tray open could run before the new process became observable and launch a duplicate instance.
2. Diagnostics creation could receive duplicate same-frame frontend dispatch while its dynamic Tauri window was still being created.
3. Main auto-height IPC writes were not ordered, so an older resize request could complete after a newer measurement and leave the native window at a stale height.

## Goal

Retain operation ownership until externally observable completion and ensure window operations are idempotent or ordered at their public frontend boundary.

## Scope

- Keep Happ open under the shared backend operation lock until the exact selected executable becomes observable.
- Stop Happ startup waiting promptly if the selected-client context changes.
- Fail closed with an explicit timeout when the exact Happ process never appears.
- Coalesce concurrent Diagnostics open calls into one Tauri invoke and release ownership after success or failure.
- Serialize Main height writes so the newest measurement is always applied last.
- Keep resize serialization usable after an individual IPC failure.
- Add focused frontend and Rust regression coverage.

## Out of scope

- Changing adapter capability claims.
- Adding Happ profile/server or subscription control.
- Adding Linux/macOS support.
- Changing Diagnostics URL policy or network probing behavior.

## Acceptance criteria

- [ ] A queued Happ open cannot launch a second instance while the first exact process is still starting.
- [ ] Happ startup ownership is scoped to the exact executable selected for launch.
- [ ] Happ startup waiting exits when client context becomes stale.
- [ ] Happ startup timeout fails closed with a clear error.
- [ ] Duplicate Diagnostics opens produce one backend invoke.
- [ ] Diagnostics ownership is released after the invoke settles.
- [ ] Main height writes execute in request order and the latest measurement is applied last.
- [ ] A failed height write does not poison later writes.
- [ ] Focused frontend and Rust tests pass.
- [ ] Full Release Quality passes on the PR merge candidate.
- [ ] Implementation and final evidence are merged into `main`.

## Verification plan

- Rust tests for delayed readiness and fail-closed timeout behavior.
- Frontend API tests for Diagnostics coalescing, resize ordering and failure recovery.
- Existing screen, adapter, Settings/Debug/Happ lifecycle and window tests.
- npm dependency audit and TypeScript/Vite production build.
- Rust formatting, tests, both strict Clippy modes, locked build and portable Windows executable.
- Final diff, branch, PR, documentation and public-redaction review.
