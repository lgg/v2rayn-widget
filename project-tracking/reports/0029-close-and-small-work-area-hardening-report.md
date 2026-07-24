# 0029 - Safe Close and Small Work-Area Hardening Report

## Status

Implementation and repository-controlled review complete. The permanent exact-head Windows gate and merge remain pending because the dedicated self-hosted runner has not accepted the queued job.

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
- configured and runtime native minimum sizes;
- logical/physical units and active DPI scale factor;
- multi-monitor work areas, negative coordinates, small/RDP screens and decorated frames;
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

## Permanent regression coverage

Frontend:

- failed close returns `false` and shows a localized accessible banner;
- successful close returns `true` without feedback;
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
- unconstrained fixed Settings/Happ windows do not receive invented minima;
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

### Happ

Confirmed unchanged and truthful:

- supported baseline: detection/path/process, open and diagnostics;
- experimental after explicit consent and successful probe: connection state/control and exact visible transport label;
- research-required: profile/server list or selection, restart/reload and subscriptions.

Unsupported and research-required operations still fail explicitly and are not rendered as stable success.

## Files and modules changed

- frontend close API, feedback event and banner;
- Settings, Debug and Happ Setup surfaces;
- frontend entry point, EN/RU catalogs and component tests;
- Tauri native close forwarding;
- work-area/minimum-size/DPI geometry helper and Rust tests;
- product surface/IPC/source drift contracts;
- README, architecture, roadmap and task/report 0029.

## Verification status

Release Quality #343 (`30111918962`) remained queued without starting any job step because the dedicated `[self-hosted, v2rayn-widget-ci]` runner did not accept it. This report update creates a new exact-head run; only the latest head/run may authorize merge.

Still pending on the final exact PR head:

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

No successful test/build claim is made from a queued job. Static review and deterministic contracts do not substitute for the required Windows execution gate.

## What cannot be fully automated

- visual screenshot comparison across every DPI, font renderer and Windows theme;
- real v2rayN/Happ UI Automation against every released client version and language;
- every interactive desktop, RDP and privilege/UIPI configuration.

The implementation remains fail-closed for ambiguous UI Automation and now fail-visible for auxiliary close errors.

## Residual risks

- native window managers can differ in timing, so Windows CI release build plus pure geometry contracts are both retained;
- experimental client UI Automation remains version-sensitive;
- user-configured Diagnostics remains an external HTTP(S) page but has no default Tauri IPC capability;
- unsupported/research-required functions remain intentionally unavailable.

## Redaction review

Completed. No private endpoint, subscription, local user directory, credential, runtime config, private log or personal data was introduced.

## Next steps

1. Run the permanent exact-head frontend and Rust jobs when the dedicated runner is available.
2. Resolve every diagnostic finding, if any.
3. Squash-merge only a fully green exact head.
4. Record the final run and merge evidence in task/report 0029 through a minimal follow-up PR.
