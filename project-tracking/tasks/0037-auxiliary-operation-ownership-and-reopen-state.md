# 0037 - Auxiliary Operation Ownership and Reopen State

## Metadata

| Field | Value |
| --- | --- |
| Status | Done |
| Priority | P1 |
| Type | audit/hardening |
| Base | `c6d38d5a551030ba3047f9b5c48a93b51f0029c0` |
| Verified head | `e42df15385a46f719e02ca0ac68965882e723fdd` |
| Verified PR merge candidate | `5f1efdef33ab01aad9d8b43c0b07a6cb721719fd` |
| Merge commit | `73cf16257209e8de9947545be758c02e2e6902e3` |
| Public redaction | Reviewed |

## Context

A new independent pass over the merged `main` tree found auxiliary-window lifecycle defects that were not covered by audit 0035:

1. Debug Tools swallowed initial settings-load failures and could remain on an indefinite loading state without an error or retry path.
2. A native Happ Setup close request could race an in-flight detect, probe or save operation; a save could continue after the window had been discarded and hidden.
3. Rapid duplicate operation dispatch could create overlapping Happ Setup operations before React rendered the disabled state.
4. Settings and Happ Setup are hidden rather than destroyed, so a successful discard could leave draft-only state mounted and visible again on the next open.

## Goal

Make auxiliary windows own their asynchronous operations and ensure a successful safe close starts the next open from authoritative persisted state.

## Scope completed

- Added explicit Debug settings-load error and Retry behavior.
- Deferred Happ Setup native close requests until the active operation settles.
- Serialized Happ Setup operation dispatch synchronously through a ref guard.
- Prevented edits and duplicate close actions while discard confirmation or safe close is active.
- Reloaded only the matching current hidden Settings/Happ Setup Tauri webview after a successful backend close.
- Preserved fail-safe behavior when Main restoration or source hiding fails.
- Added focused frontend regression tests.

## Out of scope

- Changing v2rayN or Happ adapter capabilities.
- Adding subscription support.
- Changing Windows process, UI Automation or installer behavior.

## Acceptance criteria

- [x] Debug Tools exits loading, shows a localized settings-load error and offers Retry.
- [x] Retry loads settings, restores adapter gating and starts the initial v2rayN probe when appropriate.
- [x] Happ Setup does not close or expose discard confirmation while a save/probe/detect operation is still running.
- [x] A close requested during a successful save executes only after the saved authoritative state is applied.
- [x] Duplicate operation dispatch is rejected synchronously before React renders disabled controls.
- [x] A successful close reloads only the matching current Settings or Happ Setup Tauri surface so discarded drafts cannot reappear.
- [x] A failed safe close preserves the current draft and visible failure feedback.
- [x] Frontend tests and production build pass with no React act warnings.
- [x] Release Quality passes on the exact PR merge candidate generated from the verified head and current `main`.
- [x] The implementation is merged into `main`.

## Verification evidence

- Release Quality `#491` completed successfully for PR merge candidate `5f1efdef33ab01aad9d8b43c0b07a6cb721719fd`, generated from head `e42df15385a46f719e02ca0ac68965882e723fdd` and base `c6d38d5a551030ba3047f9b5c48a93b51f0029c0`.
- Workflow and installer contracts passed; npm audit reported zero vulnerabilities.
- All 23 frontend test files and all 96 frontend tests passed without React act warnings.
- TypeScript/Vite production build passed.
- Rust formatting, Rust tests, strict Clippy, strict release-configuration Clippy and locked build checks passed.
- Portable Windows executable smoke artifact was built and uploaded successfully.
- Pull request `#33` was squash-merged into `main` as `73cf16257209e8de9947545be758c02e2e6902e3`.

## Residual limitations

Subscription operations remain unsupported. Linux/macOS support remains deferred. Happ connection control remains explicitly experimental and opt-in.
