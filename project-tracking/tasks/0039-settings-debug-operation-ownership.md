# 0039 - Main, Settings and Debug Operation Ownership

## Metadata

| Field | Value |
| --- | --- |
| Status | Done |
| Priority | P1 |
| Type | audit/hardening |
| Base | `b9cb335929752078ab0f4b4fc3c58c3dda123125` |
| Verified head | `198901248968b31e0777b7896559ef982a6e56ed` |
| Verified PR merge candidate | `bf235ce959855016ef3dd9e085f36c96baedf82a` |
| Merge commit | `052fb793fa2962df5a8de8b79c3caf2912c41442` |
| Public redaction | Reviewed |

## Context

A fresh audit of the merged `main` tree found six lifecycle defects that were not covered by the prior auxiliary-window pass:

1. Settings rendered its discard confirmation inside the fieldset disabled by that same confirmation state, making Keep editing and Discard changes natively inoperable.
2. A native Settings close request during a full Save could resume from the same serialized queue and issue a second safe-close command alongside Save.
3. Settings path Detect and Validate had no synchronous ownership, so they could overlap, accept a late stale response or be followed by close while still mutating the draft.
4. Debug Tools used React state alone to disable commands, so two clicks before the next render could enqueue two mutating backend operations; a double Toggle could execute twice.
5. Main client switching, connection Toggle and profile selection also relied on React rendering alone; two same-frame events could dispatch duplicate store/backend operations.
6. Administrator relaunch had no process-wide backend guard, so concurrent requests from any window could issue multiple Windows `runas` launches.

## Goal

Give Main, Settings and Debug explicit synchronous ownership of interactive operations and close requests, and enforce process-wide ownership for administrator relaunch.

## Scope completed

- Kept Settings discard controls outside the disabled editable fieldset.
- Disabled Save and all editable controls while discard confirmation is open.
- Rejected duplicate Settings discard close synchronously.
- Deferred native Settings close requests while a full Save is running and closed exactly once after successful save.
- Serialized Settings path Detect/Validate, rejected stale results and deferred close until the operation settled.
- Routed failed/invalid deferred save-close requests through the normal unsaved-draft confirmation.
- Rejected duplicate Debug operations synchronously before React rerenders.
- Deferred Debug native/custom close until the active operation settled.
- Rejected duplicate Main client switch, connection Toggle and profile selection at the Zustand store boundary.
- Rejected duplicate administrator relaunch in the Rust service before invoking `ShellExecuteW`.
- Added focused frontend and Rust regression coverage.

## Out of scope

- Changing adapter capability claims.
- Changing v2rayN or Happ backend control behavior.
- Adding subscription or cross-platform support.

## Acceptance criteria

- [x] Settings Keep editing and Discard changes remain operable when confirmation is visible.
- [x] Settings editable controls and Save are disabled while confirmation is visible.
- [x] Rapid duplicate Discard dispatch produces only one safe-close command.
- [x] Native close during full Save does not issue a parallel or duplicate close.
- [x] Settings path operations reject duplicate dispatch and late stale responses.
- [x] Close during a path operation waits and opens unsaved confirmation when the result changes the draft.
- [x] A failed or invalid Save followed by deferred close preserves the draft and opens confirmation.
- [x] Rapid duplicate Debug mutation dispatch produces only one backend command.
- [x] Debug close waits until the active operation and its post-operation probe settle.
- [x] Rapid duplicate Main Toggle, client switch and profile selection each dispatch only one backend operation.
- [x] Concurrent administrator relaunch requests produce only one `runas` attempt.
- [x] Existing safe-close failure behavior remains intact.
- [x] All frontend tests and production build pass without React act warnings.
- [x] Rust tests, formatting, strict Clippy and portable release build pass.
- [x] Full Release Quality passes on the PR merge candidate.
- [x] Implementation and final evidence are merged into `main`.

## Verification evidence

- Release Quality `#504` completed successfully for PR merge candidate `bf235ce959855016ef3dd9e085f36c96baedf82a`, generated from head `198901248968b31e0777b7896559ef982a6e56ed` and base `b9cb335929752078ab0f4b4fc3c58c3dda123125`.
- Workflow and installer contracts passed; npm audit reported zero vulnerabilities.
- All 26 frontend test files and all 104 frontend tests passed without React act warnings.
- TypeScript/Vite production build passed.
- Rust formatting, Rust tests, strict Clippy, strict release-configuration Clippy and locked build checks passed.
- Portable Windows executable smoke artifact was built and uploaded successfully.
- Pull request `#35` was squash-merged into `main` as `052fb793fa2962df5a8de8b79c3caf2912c41442`.

## Residual limitations

Subscription operations remain unsupported. Linux/macOS support remains deferred. Happ connection control remains explicitly experimental and opt-in.
