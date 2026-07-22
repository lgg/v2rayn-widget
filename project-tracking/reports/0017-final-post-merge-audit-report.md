# 0017 - Final Post-Merge Audit Report

## Audited baseline

The audit started from the exact `main` commit produced by PR #4:

- `811f6ccf49489ad699f5cd97e0a3454e8fae0eef`

The review was performed in a separate branch and PR. The full repository tree, every file changed by PR #4 and all runtime callers of those changes were inspected together.

## Confirmed defects

### Control-operation races

Foreground, background and control commands shared one client epoch but were not serialized. Two toggle/profile operations could overlap, and a slower refresh could commit stale status after a completed control action.

### Unprovable UI success

A successful UI Automation call was treated as sufficient even when no state change was observed. When the pre-action state was unknown, any later boolean value could be accepted as confirmation.

UI confirmation also used the backup-capable observation reader. A temporarily missing or invalid primary file could therefore expose stale backup state and falsely confirm an action.

### Unsafe fallback semantics

The fallback toggled whichever value happened to be present after the UI timeout. A late successful UI write could therefore be inverted back to the original state.

The old reload path only reread the config file that the widget had just written; it did not prove that the running v2rayN process had applied the setting.

### External config schema mutation

Mutation code could restore a missing primary config from `.bak`, retype non-boolean fields, or invent an entire `TunModeItem` with hard-coded routing, stack and MTU values. These operations exceeded the requested Enable TUN change and could alter unknown v2rayN schemas.

Observation could also discover `TunModeItem` inside profile records and report it as the global state.

### Multiple processes and permissions

Only one matching PID was retained. Restart could terminate one process and leave another selected-installation instance running. Config fallback could write first and only then discover that an elevated process could not be restarted.

### Window targeting

The TUN candidate classifier accepted any clickable UI element containing `tun`, and native fallback clicked the first child containing that token. A TUN settings/routing control could therefore be clicked instead of the explicit Enable TUN action.

Profile matching used substring/token scoring, so a short profile such as `US` could match `RUSSIAN` before post-action confirmation. Reload diagnostics similarly accepted broad labels such as subscription reload actions.

### Application opening

The Open command spawned the executable even when the configured installation was already running, potentially creating a duplicate instance.

## Implemented corrections

- added one async v2rayN operation lock shared by refresh, toggle, profile, open/restart and debug control commands;
- reject queued operations when their selected-client epoch changed before execution;
- confirm UI actions only from a valid primary config, never from `.bak`;
- require a known boolean pre-state and an actual boolean transition for TUN UI success;
- set the explicit desired TUN state during fallback instead of toggling the latest value;
- restart the selected installation after config fallback instead of treating a config reread as reload confirmation;
- preflight every matching process privilege before mutating config that requires restart;
- retain every matching PID and terminate all selected-installation processes with aggregated failures;
- wait for complete process exit and verified startup with bounded polling;
- activate an existing configured-installation window and refuse duplicate launch when activation is impossible;
- prohibit mutation recovery from backup and require a valid primary config;
- mutate only existing boolean TUN fields and preserve unknown/non-boolean schemas;
- ignore profile-record TUN data when resolving global state;
- make explicit TUN writes idempotent for late UI completion;
- require explicit clickable Enable TUN labels/automation IDs and remove broad native TUN fallback;
- require exact profile names and reject ambiguous UI matches;
- require explicit Reload labels/automation IDs in the debug-only reload action;
- keep runtime window resizability covered directly against `tauri.conf.json`.

## Regression coverage

Focused Rust tests cover:

- strict primary reads versus backup-capable observation;
- missing/corrupt primary mutation rejection;
- non-boolean and unknown TUN schema preservation;
- lowercase existing TUN fields and idempotent explicit state setting;
- profile-record TUN isolation;
- guarded concurrent config changes;
- observable TUN transition requirements;
- v2rayN operation-lock serialization;
- exact TUN, Reload and profile UI candidate classification;
- existing executable working directory and window-resizability contracts.

## Verification gate

The final PR head must pass the permanent `Release Quality` workflow:

1. reproducible frontend install;
2. high-severity dependency audit;
3. frontend tests and production build;
4. complete Rust workspace formatting;
5. locked Rust tests;
6. strict Clippy with warnings denied;
7. locked Rust check;
8. portable Windows release build and artifact verification;
9. clean frontend reinstall for packaging;
10. real Tauri NSIS build and installer artifact verification.

## Residual risks

Windows UI Automation remains dependent on the installed v2rayN UI, desktop session and privilege isolation. The implementation now requires exact process/window/action identity, exact post-action state confirmation and a fail-closed fallback, but hosted CI cannot interactively validate every future v2rayN release.

The external config still has no cross-process transaction or advisory-lock contract. Compare-before-replace, strict primary reads, idempotent explicit writes and serialized in-process operations substantially narrow the race, but cannot prevent a hostile or simultaneous external writer from changing the file immediately after the final comparison.
