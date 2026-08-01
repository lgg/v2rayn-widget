# 0039 - Settings and Debug Operation Ownership Report

## Status

Implementation complete; merge-candidate verification pending.

## Audit coverage

- Settings discard confirmation semantics and native disabled-state behavior.
- Settings full-save serialization and native/custom close races.
- Debug command dispatch before React disabled-state rendering.
- Debug native/custom close during active command and post-command probe.
- Shared safe-close failure behavior.
- Existing frontend and native release gates.

## Confirmed findings

1. The Settings discard buttons were descendants of a disabled fieldset and therefore could not be operated through normal browser interaction.
2. The Settings Save button remained active while discard confirmation was visible.
3. Native Settings close during full Save could wait for the Save queue and then race Save's own close, issuing two safe-close calls.
4. Debug Tools had no synchronous operation guard, allowing two rapid commands before React rendered disabled controls.
5. Debug could be hidden while a mutating command and its confirmation probe were still running.

## Implemented corrections

- Moved Settings discard confirmation outside the disabled editable fieldset.
- Disabled the editable Settings form and Save while confirmation is visible.
- Added synchronous Settings save/close/discard ownership refs.
- Deferred native Settings close while Save is active and coalesced it into the Save-owned close.
- Preserved the draft and normal confirmation path when validation or saving does not complete successfully.
- Added a synchronous Debug operation guard independent of React rendering.
- Deferred Debug close until the active operation, snapshots and requested post-operation probe settle.
- Disabled Debug commands while close is in progress.

## Verification evidence

Pending Release Quality on the current PR merge candidate.

## Residual limitations

Subscription operations remain unsupported. Linux/macOS remain deferred. Happ connection control remains experimental and opt-in. This audit does not change adapter capability claims.

## Public redaction review

Passed. Added tests contain only neutral placeholder settings, process IDs and URLs; no credentials, subscription data, private endpoints, runtime logs or personal data are included.
