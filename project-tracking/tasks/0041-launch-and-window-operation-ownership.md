# 0041 - Launch and Window Operation Ownership

## Metadata

| Field | Value |
| --- | --- |
| Status | Done |
| Priority | P1 |
| Type | audit/hardening |
| Base | `0c172d87868d8fbe5c4d96b77ff975ce376b4811` |
| Verified head | `de903b606c0c07f455f8998e82085964e7b08b89` |
| Verified PR merge candidate | `1dde9fdeec83855ee695939ff246b0d2a0fff353` |
| Merge commit | `5d06a9ab3b348b5dbfb460e987cbca9fdc02ea1a` |
| Public redaction | Reviewed |

## Context

A fresh independent audit of the merged `main` tree found three remaining asynchronous ownership gaps:

1. Happ open held the shared adapter lock only through `Command::spawn()`. A queued Main or Tray open could run before the new process became observable and launch a duplicate instance.
2. Diagnostics creation could receive duplicate same-frame frontend dispatch while its dynamic Tauri window was still being created.
3. Main auto-height IPC writes were not ordered, so an older resize request could complete after a newer measurement and leave the native window at a stale height.

## Goal

Retain operation ownership until externally observable completion and ensure window operations are idempotent or ordered at their public frontend boundary.

## Scope completed

- Kept Happ open under the shared backend operation lock until the exact selected executable became observable.
- Stopped Happ startup waiting promptly when selected-client context changed.
- Failed closed with an explicit timeout when the exact Happ process did not appear.
- Coalesced concurrent Diagnostics open calls into one Tauri invoke and released ownership after success or failure.
- Serialized Main height writes so the newest measurement is always applied last.
- Kept resize serialization usable after an individual IPC failure.
- Added focused frontend and Rust regression coverage.

## Out of scope

- Changing adapter capability claims.
- Adding Happ profile/server or subscription control.
- Adding Linux/macOS support.
- Changing Diagnostics URL policy or network probing behavior.

## Acceptance criteria

- [x] A queued Happ open cannot launch a second instance while the first exact process is still starting.
- [x] Happ startup ownership is scoped to the exact executable selected for launch.
- [x] Happ startup waiting exits when client context becomes stale.
- [x] Happ startup timeout fails closed with a clear error.
- [x] Duplicate Diagnostics opens produce one backend invoke.
- [x] Diagnostics ownership is released after the invoke settles.
- [x] Main height writes execute in request order and the latest measurement is applied last.
- [x] A failed height write does not poison later writes.
- [x] Focused frontend and Rust tests pass.
- [x] Full Release Quality passes on the PR merge candidate.
- [x] Implementation and final evidence are merged into `main`.

## Verification evidence

- Release Quality `#508` completed successfully for PR merge candidate `1dde9fdeec83855ee695939ff246b0d2a0fff353`, generated from head `de903b606c0c07f455f8998e82085964e7b08b89` and base `0c172d87868d8fbe5c4d96b77ff975ce376b4811`.
- Workflow and installer contracts passed; npm audit reported zero vulnerabilities.
- All 27 frontend test files and all 107 frontend tests passed without React act warnings.
- TypeScript/Vite production build passed.
- Rust formatting and all 136 Rust tests passed.
- Strict normal Clippy, strict release-configuration Clippy and locked build checks passed.
- Portable Windows executable smoke artifact was built and uploaded successfully.
- Pull request `#37` was squash-merged into `main` as `5d06a9ab3b348b5dbfb460e987cbca9fdc02ea1a`.

## Residual limitations

Subscription operations remain unsupported. Linux/macOS support remains deferred. Happ connection control remains explicitly experimental and opt-in.
