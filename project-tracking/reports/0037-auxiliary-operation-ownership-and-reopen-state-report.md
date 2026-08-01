# 0037 - Auxiliary Operation Ownership and Reopen State Report

## Status

Complete. The verified PR merge candidate passed Release Quality and the implementation was squash-merged into `main`.

## Audit coverage

- Debug Tools initial settings bootstrap and retry behavior.
- Happ Setup detect/probe/save ownership, duplicate dispatch and native close routing.
- Settings/Happ Setup hidden-window reopen lifecycle.
- Shared frontend close API and backend safe-close boundary.
- Focused regression coverage and full quality workflow compatibility.

## Confirmed findings

1. Debug Tools ignored `getSettings`/surface-application failures and could remain in `Loading...` forever with every action disabled.
2. Happ Setup native close did not own the current asynchronous operation, allowing discard/close to race an in-flight save.
3. Two rapid actions could start overlapping Happ Setup operations before React rendered disabled controls.
4. Successful discard hid Settings/Happ Setup without destroying their mounted React state, so discarded drafts could reappear on the next open.

## Implemented corrections

- Debug Tools now exposes a localized settings-load alert, leaves the loading state and offers Retry.
- A successful Debug retry restores the authoritative selected-client gate and initial probe flow.
- Happ Setup tracks operation and close ownership separately; native close requests are deferred until the operation settles.
- A synchronous ref guard rejects duplicate detect/probe/save dispatch before React rerenders.
- Happ Setup disables editable fieldsets and close/discard actions while an operation or safe close is active.
- The shared close API reloads only the matching current hidden `settings` or `happ-setup` Tauri webview after the backend close succeeds.
- Post-close reload is isolated from the safe-close transaction, so cleanup failure cannot turn an already successful close into a false failure.
- Backend close failure behavior is unchanged: the source remains visible, the draft is retained and accessible failure feedback remains active.

## Verification evidence

- Verified source head: `e42df15385a46f719e02ca0ac68965882e723fdd`.
- Verified PR merge candidate: `5f1efdef33ab01aad9d8b43c0b07a6cb721719fd` against base `c6d38d5a551030ba3047f9b5c48a93b51f0029c0`.
- Release Quality run `#491`: successful.
- Workflow and installer contracts passed; npm audit found zero vulnerabilities.
- Frontend: 23 test files and 96 tests passed without React act warnings; TypeScript/Vite production build passed.
- Rust Windows: rustfmt, Rust tests, strict normal/release Clippy checks and locked build passed.
- Portable Windows executable smoke artifact was built and uploaded successfully.
- Pull request `#33` was squash-merged into `main` as `73cf16257209e8de9947545be758c02e2e6902e3`.

## Files changed

- `src/frontend/src/app/DebugWindow.tsx`
- `src/frontend/src/app/HappSetupWindow.tsx`
- `src/frontend/src/lib/api.ts`
- focused frontend test files for all confirmed regressions
- task/report 0037

## Residual limitations

No adapter capability claims changed. Subscription operations remain unsupported, Linux/macOS remain deferred, and Happ connection control remains experimental and opt-in.

## Public redaction review

Passed. Tests use neutral placeholder Windows paths and contain no credentials, subscription URLs, private endpoints, runtime logs or personal data.
