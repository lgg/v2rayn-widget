# 0037 - Auxiliary Operation Ownership and Reopen State Report

## Status

Implementation complete; exact-head verification pending.

## Audit coverage

- Debug Tools initial settings bootstrap and retry behavior.
- Happ Setup detect/probe/save ownership and native close routing.
- Settings/Happ Setup hidden-window reopen lifecycle.
- Shared frontend close API and backend safe-close boundary.
- Focused regression coverage and full quality workflow compatibility.

## Confirmed findings

1. Debug Tools ignored `getSettings`/surface-application failures and could remain in `Loading...` forever with every action disabled.
2. Happ Setup native close did not own the current asynchronous operation, allowing discard/close to race an in-flight save.
3. Successful discard hid Settings/Happ Setup without destroying their mounted React state, so discarded drafts could reappear on the next open.

## Implemented corrections

- Debug Tools now exposes a localized settings-load alert, leaves the loading state and offers Retry.
- A successful Debug retry restores the authoritative selected-client gate and initial probe flow.
- Happ Setup tracks operation and close ownership separately; native close requests are deferred until the operation settles.
- Happ Setup disables editable fieldsets and close/discard actions while an operation or safe close is active.
- The shared close API reloads only the current hidden `settings` or `happ-setup` webview after the backend close succeeds.
- Backend close failure behavior is unchanged: the source remains visible, the draft is retained and accessible failure feedback remains active.

## Files changed

- `src/frontend/src/app/DebugWindow.tsx`
- `src/frontend/src/app/HappSetupWindow.tsx`
- `src/frontend/src/lib/api.ts`
- focused frontend test files for all three regressions
- task/report 0037

## Verification evidence

Pending exact-head Release Quality.

## Residual limitations

No adapter capability claims changed. Subscription operations remain unsupported, Linux/macOS remain deferred, and Happ connection control remains experimental and opt-in.

## Public redaction review

Passed. Tests use neutral placeholder Windows paths and contain no credentials, subscription URLs, private endpoints, runtime logs or personal data.
