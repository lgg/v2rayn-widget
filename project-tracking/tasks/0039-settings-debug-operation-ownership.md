# 0039 - Main, Settings and Debug Operation Ownership

## Metadata

| Field | Value |
| --- | --- |
| Status | In Progress |
| Priority | P1 |
| Type | audit/hardening |
| Base | `b9cb335929752078ab0f4b4fc3c58c3dda123125` |
| Public redaction | Reviewed |

## Context

A fresh audit of the current merged `main` tree found five lifecycle defects that were not covered by the prior auxiliary-window pass:

1. Settings rendered its discard confirmation inside the fieldset disabled by that same confirmation state, making Keep editing and Discard changes natively inoperable.
2. A native Settings close request during a full Save could resume from the same serialized queue and issue a second safe-close command alongside Save.
3. Settings path Detect and Validate had no synchronous ownership, so they could overlap, accept a late stale response or be followed by close while still mutating the draft.
4. Debug Tools used React state alone to disable commands, so two clicks before the next render could enqueue two mutating backend operations; a double Toggle could execute twice.
5. Main client switching, connection Toggle and profile selection also relied on React rendering alone; two same-frame events could dispatch duplicate store/backend operations.

## Goal

Give Main, Settings and Debug explicit synchronous ownership of interactive operations and close requests, while preserving visible fail-safe behavior when backend close fails.

## Scope

- Keep Settings discard controls outside the disabled editable fieldset.
- Disable Save and all editable controls while discard confirmation is open.
- Reject duplicate Settings discard close synchronously.
- Defer native Settings close requests while a full Save is running and close exactly once after successful save.
- Serialize Settings path Detect/Validate, reject stale results and defer close until the operation settles.
- Convert failed/invalid deferred save-close requests into the normal unsaved-draft confirmation.
- Reject duplicate Debug operations synchronously before React rerenders.
- Defer Debug native/custom close until the active operation settles.
- Reject duplicate Main client switch, connection Toggle and profile selection at the Zustand store boundary.
- Add focused frontend regression coverage.

## Out of scope

- Changing adapter capability claims.
- Changing v2rayN or Happ backend control behavior.
- Adding subscription or cross-platform support.

## Acceptance criteria

- [ ] Settings Keep editing and Discard changes remain operable when confirmation is visible.
- [ ] Settings editable controls and Save are disabled while confirmation is visible.
- [ ] Rapid duplicate Discard dispatch produces only one safe-close command.
- [ ] Native close during full Save does not issue a parallel or duplicate close.
- [ ] Settings path operations reject duplicate dispatch and late stale responses.
- [ ] Close during a path operation waits and opens unsaved confirmation when the result changes the draft.
- [ ] A failed or invalid Save followed by deferred close preserves the draft and opens confirmation.
- [ ] Rapid duplicate Debug mutation dispatch produces only one backend command.
- [ ] Debug close waits until the active operation and its post-operation probe settle.
- [ ] Rapid duplicate Main Toggle, client switch and profile selection each dispatch only one backend operation.
- [ ] Existing safe-close failure behavior remains intact.
- [ ] All frontend tests and production build pass without React act warnings.
- [ ] Full Release Quality passes on the PR merge candidate.
- [ ] Implementation and final evidence are merged into `main`.

## Verification plan

- Focused Settings accessibility, path-operation and close-ownership tests.
- Focused Debug duplicate-dispatch and deferred-close test.
- Focused dashboard-store duplicate-dispatch tests.
- Existing Main, Settings, Debug and auxiliary lifecycle suites.
- Full frontend tests, dependency audit and production build.
- Rust formatting, tests, strict Clippy, locked build and portable Windows executable through Release Quality.
- Final diff, documentation and public-redaction review.
