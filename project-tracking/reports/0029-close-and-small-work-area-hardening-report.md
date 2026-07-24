# 0029 - Safe Close and Small Work-Area Hardening Report

## Status

Implementation and repository-controlled review complete. The permanent exact-head Windows gate and merge remain pending; only a fully green run for the latest branch head may authorize merge.

## Audited baseline

The second independent audit started from exact `main` commit:

`1333c415f216f83d15c45da43f23a23d22df2907`

The previous 0028 report was used only as a list of claims to challenge, not as verification evidence.

## Audit method

The review cross-checked:

- README and architecture claims against concrete source paths;
- all four local React surfaces and external Diagnostics;
- custom and native window-close handlers;
- unsaved-draft state transitions;
- every frontend Tauri `invoke` declaration against `tauri::generate_handler!` including duplicate detection;
- configured and runtime native minimum and fixed window sizes;
- saved-position recovery and the actual frameless top drag affordance;
- logical/physical units and active DPI scale factor;
- multi-monitor work areas, negative coordinates, small/RDP screens and decorated frames;
- adapter operation locks, epochs and stale-result rejection;
- EN/RU catalog parity;
- v2rayN/Happ descriptors, frontend gating and adapter methods;
- current validation-only self-hosted CI policy;
- repository public-data/redaction constraints.

## Confirmed defects and corrections

### 1. Native minimum size defeated work-area fitting

Main, Debug and Diagnostics had preferred minimum sizes. The fitting code could request a smaller target, but the native window manager was still allowed to enforce a larger minimum and place part of the window outside a small or RDP work area.

Correction:

- calculate maximum available inner size after measuring the decorated frame;
- cap the native minimum to that available inner size;
- restore the preferred minimum when sufficient space becomes available again.

### 2. Minimum restoration could invalidate position clamping

When returning from a constrained monitor to a larger one, restoring a preferred minimum could expand the window after the old position had already been accepted.

Correction:

- derive the final outer target from current size, frame size, preferred/capped minimum and available work area;
- clamp both final size and final position from that single geometry result.

### 3. Preferred minimums mixed logical and physical units

Tauri configuration and builder sizes are logical pixels, while monitor work areas and runtime outer/inner sizes are physical pixels. Treating `360×270`, `460×420` and `760×520` as physical values would restore undersized minimums on high-DPI displays.

Correction:

- read the current window scale factor;
- convert preferred `LogicalSize` values to `PhysicalSize` before comparison and native minimum application;
- add deterministic 150% and 200% DPI regressions;
- contract-test consistency between Tauri declarations, Diagnostics builder and logical geometry constants.

### 4. Auxiliary React windows bypassed safe close

Settings, Debug and Happ Setup caught `close_window` rejection and called native `.hide()` directly. This contradicted the backend rule that Main must be restored before the source can disappear.

Correction:

- removed every direct `.hide()` from auxiliary React surfaces;
- `closeWindow` now returns a boolean success outcome instead of rejecting into unsafe fallback code;
- backend failure dispatches a shared close-failure event and deliberately leaves the source visible.

### 5. Settings failed discard lost dirty-state protection

Settings cleared its dirty flag before knowing whether the safe backend close succeeded.

Correction:

- discard confirmation and dirty state are cleared only after `closeWindow("settings")` returns `true`;
- a failed close leaves both the draft and confirmation available.

### 6. Happ failed discard dismissed its confirmation

Happ Setup closed the confirmation before safe close completed.

Correction:

- confirmation remains open after failure;
- the current path/consent draft remains unchanged.

### 7. Native Debug close had no user-visible failure path

The native title-bar close handler called the Rust close command directly and only logged an error.

Correction:

- Rust emits `debug-close-requested`;
- Debug React surface handles it through the same shared safe-close API as the custom close button;
- the global accessible alert is therefore available for both close paths.

### 8. Happ draft could be overwritten by language change

Happ Setup initial load depended on the translated `t` function. A runtime language change could recreate that function, re-run the load effect and overwrite an unsaved setup draft with persisted backend values.

Correction:

- load effect depends on the stable i18n instance and explicit retry counter;
- translated load errors use `i18n.t` inside the effect;
- a component regression changes language while a draft path is present and verifies only one settings load.

### 9. Architecture CI documentation was stale

`docs/architecture.md` still described ordinary dependency installation and an NSIS build in the PR quality workflow.

Correction:

- document the current validation-only self-hosted runner;
- document `npm ci --ignore-scripts`, immutable prerequisites, complete Rust formatting, both strict Clippy modes, locked check and portable release smoke build;
- keep installer generation isolated to the trusted release-assets workflow.

### 10. Fixed windows stayed undersized after constrained sessions

Settings and Happ Setup are configured as fixed-size windows. Work-area fitting correctly shrank them on a short RDP or tiny monitor, but there was no preferred-size restoration path when sufficient space later returned. Reopening could therefore preserve the constrained dimensions indefinitely.

Correction:

- represent the configured Settings `430×760` and Happ Setup `500×720` inner sizes as explicit logical preferences;
- convert them to physical pixels using the active window scale factor;
- on every application-controlled show/fitting pass, target the configured size when the work area can contain it and otherwise bound it to the available area;
- contract-test the constants against `tauri.conf.json` so configured and runtime sizes cannot drift silently.

### 11. Successful retry could leave stale close-failure feedback

A failed close stored the accessible error banner in that window's React state. A later successful close did not clear it, so the hidden webview could show an obsolete failure when reopened.

Correction:

- dispatch a label-scoped clear event before each new close attempt;
- remove only the matching window's previous failure state;
- let the current attempt report a new failure if Rust rejects again;
- add a component regression covering failed attempt followed by successful retry.

### 12. Saved-position validation did not validate the actual drag strip

The helper named `saved_position_has_visible_drag_area` accepted any sufficiently large intersection between the saved window body and a monitor. For a frameless window, a visible lower body sliver is not the recovery affordance; the user needs the top drag strip. Final work-area fitting still bounded the window, so this was primarily an incorrect restore-versus-center decision rather than an unbounded off-screen result.

Correction:

- model the recoverable area as the top `48` physical pixels of the saved rectangle;
- require up to `80×48` of that actual top strip to be visible on one current monitor;
- center before final fitting when only another part of the body is visible;
- add a regression where the lower body intersects the monitor while the top strip remains off-screen.

### 13. Inactive Happ settings invalidated unrelated active operations

`update_happ_settings` always used `replace_settings_and_status_invalidating_context`. When v2rayN was selected, changing only Happ's path or UI Automation consent incremented the active client epoch and could make an unrelated in-flight v2rayN operation return `CLIENT_CONTEXT_CHANGED`. Re-saving identical active Happ settings also reset a valid status without an operational change.

Correction:

- compare previous and final Happ operational fields;
- invalidate the epoch and reset status only when Happ is active and its path or control consent actually changes;
- update inactive Happ settings through the normal settings path, preserving the selected v2rayN epoch/status;
- preserve active Happ context/status when the submitted values are identical;
- add unit regressions for inactive update, unchanged active save and changed active save.

## Permanent regression coverage

Frontend:

- failed close returns `false` and shows a localized accessible banner;
- successful close returns `true` without feedback;
- a successful retry clears stale failure feedback from the previous attempt;
- native Debug close is forwarded to the shared frontend close API;
- failed Settings discard retains dirty state and confirmation;
- failed Happ discard retains draft and confirmation;
- Happ language change does not reload persisted settings over a draft;
- existing Settings/Happ retry, error and native-close tests remain.

Rust/source contracts:

- tiny work area caps native minima;
- large work area restores preferred minima and clamps expanded geometry;
- preferred logical minima are converted at 150% and 200% DPI;
- decorated frame is included in restored outer size;
- fixed Settings/Happ preferences are DPI-scaled, restored when space returns and bounded when constrained;
- only an actually visible top drag strip qualifies a saved frameless position for direct restoration;
- configured fixed sizes and resizability cannot drift from runtime geometry constants;
- inactive Happ settings preserve active v2rayN context/status;
- unchanged active Happ saves preserve context/status;
- changed active Happ settings invalidate context and reset stale status;
- every frontend invoke matches exactly one non-duplicated registered Tauri command and vice versa;
- auxiliary React source files contain no `.hide()`;
- native Debug close forwarding remains registered;
- preferred minimum declarations cannot silently drift;
- existing local-surface and remote Diagnostics capability contracts remain.

## Capability re-verification

### v2rayN

Confirmed unchanged and truthful:

- supported: detection/path, process and connection status, open, Enable TUN control, profile listing, restart;
- experimental: profile selection;
- unsupported: generic transport-mode reporting and all subscription operations.

The concrete operations remain path-specific, serialized and guarded by primary-config confirmation plus UIPI checks where UI control is required.

### Happ

Confirmed unchanged and truthful:

- supported baseline: detection/path/process, open and diagnostics;
- experimental after explicit consent and successful probe: connection state/control and exact visible transport label;
- research-required: profile/server list or selection, restart/reload and subscriptions.

Happ UI Automation remains fail-closed: exact Connect/Disconnect labels only, visible/enabled clickable controls, one unique candidate, confidence threshold, explicit post-click state confirmation and redacted arbitrary UI text. Unsupported and research-required operations fail explicitly and are not rendered as stable success.

## Files and modules changed

- frontend close API, label-scoped feedback events and banner;
- Settings, Debug and Happ Setup surfaces;
- frontend entry point, EN/RU catalogs and component tests;
- Tauri native close forwarding;
- client settings context-commit logic and Rust regressions;
- work-area/minimum/fixed-size/DPI/saved-position geometry helper and Rust tests;
- product surface/IPC/source and configuration drift contracts;
- README, architecture, roadmap and task/report 0029.

## Verification status

The permanent `Release Quality` workflow is serialized on the dedicated `[self-hosted, v2rayn-widget-ci]` Windows runner. Each branch update creates a new exact-head run; only the latest head/run may authorize merge.

Still required on the final exact PR head:

- workflow contracts;
- frontend dependency audit;
- complete frontend tests;
- production frontend build;
- complete Rust formatting;
- Rust unit/integration tests;
- strict all-targets Clippy;
- strict release/no-default-features Clippy;
- locked Cargo check;
- portable release smoke build;
- artifact and diagnostics upload;
- cleanup and aggregate gate.

No successful test/build claim is made until the exact final head completes. Static review and deterministic contracts do not substitute for the required Windows execution gate.

## What cannot be fully automated

- visual screenshot comparison across every DPI, font renderer and Windows theme;
- real v2rayN/Happ UI Automation against every released client version and language;
- every interactive desktop, RDP and privilege/UIPI configuration.

The implementation remains fail-closed for ambiguous UI Automation and fail-visible for auxiliary close errors.

## Residual risks

- native window managers can differ in timing, so Windows CI release build plus pure geometry contracts are both retained;
- experimental client UI Automation remains version-sensitive;
- user-configured Diagnostics remains an external HTTP(S) page but has no default Tauri IPC capability;
- unsupported/research-required functions remain intentionally unavailable.

## Redaction review

Completed. No private endpoint, subscription, local user directory, credential, runtime config, private log or personal data was introduced.

## Next steps

1. Complete the permanent exact-head frontend and Rust jobs.
2. Resolve every diagnostic finding, if any.
3. Squash-merge only a fully green exact head.
4. Record the final run and merge evidence in task/report 0029 through a minimal follow-up PR if required.
