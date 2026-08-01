# 0037 - Auxiliary Operation Ownership and Reopen State

## Metadata

| Field | Value |
| --- | --- |
| Status | In Progress |
| Priority | P1 |
| Type | audit/hardening |
| Base | `c6d38d5a551030ba3047f9b5c48a93b51f0029c0` |
| Public redaction | Reviewed |

## Context

A new independent pass over the exact merged `main` tree found three related auxiliary-window lifecycle defects that were not covered by audit 0035:

1. Debug Tools swallowed initial settings-load failures and could remain on an indefinite loading state without an error or retry path.
2. A native Happ Setup close request could race an in-flight detect, probe or save operation; a save could continue after the window had been discarded and hidden.
3. Settings and Happ Setup are hidden rather than destroyed, so a successful discard could leave draft-only state mounted and visible again on the next open.

## Goal

Make auxiliary windows own their asynchronous operations and ensure a successful safe close starts the next open from authoritative persisted state.

## Scope

- Add explicit Debug settings-load error and Retry behavior.
- Defer Happ Setup native close requests until the active operation settles.
- Prevent edits and duplicate close actions while discard confirmation or safe close is active.
- Reload only the current hidden Settings/Happ Setup webview after a successful backend close.
- Preserve the existing fail-safe behavior when Main restoration or source hiding fails.
- Add focused frontend regression tests.

## Out of scope

- Changing v2rayN or Happ adapter capabilities.
- Adding subscription support.
- Changing Windows process, UI Automation or installer behavior.

## Acceptance criteria

- [ ] Debug Tools exits loading, shows a localized settings-load error and offers Retry.
- [ ] Retry loads settings, restores adapter gating and starts the initial v2rayN probe when appropriate.
- [ ] Happ Setup does not close or expose discard confirmation while a save/probe/detect operation is still running.
- [ ] A close requested during a successful save executes only after the saved authoritative state is applied.
- [ ] A successful close reloads only the current Settings or Happ Setup surface so discarded drafts cannot reappear.
- [ ] A failed safe close preserves the current draft and visible failure feedback.
- [ ] Frontend tests and production build pass without warnings.
- [ ] Full Release Quality passes on the exact PR head.
- [ ] The implementation and final evidence are merged into `main`.

## Verification plan

- Focused Vitest coverage for Debug load/retry.
- Focused Vitest coverage for native Happ close during a pending save.
- Pure contract test for draft-surface reload classification.
- Existing full frontend suite and TypeScript/Vite build.
- Existing full Rust formatting, tests, strict Clippy, locked check and portable release build through Release Quality.
- Diff, documentation and public-redaction review.

## Risks

- A deferred close must not execute twice after an operation settles.
- Reload must never target Main, Debug or a different window label.
- A failed backend close must not reload or erase the draft.
- Hidden-window reload must occur only after the backend proves Main is visible and the source was hidden successfully.
