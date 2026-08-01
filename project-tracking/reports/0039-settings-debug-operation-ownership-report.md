# 0039 - Main, Settings and Debug Operation Ownership Report

## Status

Implementation complete; merge-candidate verification pending.

## Audit coverage

- Main client-switch, connection-control and profile-selection dispatch.
- Settings discard confirmation semantics and native disabled-state behavior.
- Settings full-save serialization and native/custom close races.
- Settings path detection/validation ownership and stale-result handling.
- Debug command dispatch before React disabled-state rendering.
- Debug native/custom close during active command and post-command probe.
- Process-wide administrator relaunch ownership.
- Shared safe-close failure behavior.
- Existing frontend and native release gates.

## Confirmed findings

1. The Settings discard buttons were descendants of a disabled fieldset and therefore could not be operated through normal browser interaction.
2. The Settings Save button remained active while discard confirmation was visible.
3. Native Settings close during full Save could wait for the Save queue and then race Save's own close, issuing two safe-close calls.
4. Settings path Detect/Validate could overlap, apply a late stale result or continue while close was requested.
5. Debug Tools had no synchronous operation guard, allowing two rapid commands before React rendered disabled controls.
6. Debug could be hidden while a mutating command and its confirmation probe were still running.
7. Main Toggle, client switching and profile selection did not reject same-frame duplicate dispatch at the store boundary.
8. Administrator relaunch had no process-wide claim, so concurrent requests could issue multiple Windows `runas` launches.

## Implemented corrections

- Moved Settings discard confirmation outside the disabled editable fieldset.
- Disabled the editable Settings form and Save while confirmation is visible.
- Added synchronous Settings save/close/discard ownership refs.
- Deferred native Settings close while Save is active and coalesced it into the Save-owned close.
- Serialized Settings path Detect/Validate through a synchronous operation guard.
- Disabled the path section and Save while a path operation is active.
- Rejected path results invalidated by a newer authoritative settings revision.
- Deferred close during a path operation and routed a changed result through the normal unsaved confirmation.
- Preserved the draft and normal confirmation path when validation or saving does not complete successfully.
- Added a synchronous Debug operation guard independent of React rendering.
- Deferred Debug close until the active operation, snapshots and requested post-operation probe settle.
- Disabled Debug commands while close is in progress.
- Added synchronous dashboard-store guards for Main Toggle, client switch and profile selection.
- Added an atomic Rust relaunch claim shared by every frontend surface; failed launches release the claim, while a successful launch retains it until the current process exits.

## Verification evidence

Pending Release Quality on the current PR merge candidate.

## Residual limitations

Subscription operations remain unsupported. Linux/macOS remain deferred. Happ connection control remains experimental and opt-in. This audit does not change adapter capability claims.

## Public redaction review

Passed. Added tests contain only neutral placeholder settings, process IDs and URLs; no credentials, subscription data, private endpoints, runtime logs or personal data are included.
