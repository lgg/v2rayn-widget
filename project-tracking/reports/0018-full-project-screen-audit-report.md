# 0018 - Full Project and Screen Audit Report

## Audited baseline

The audit started from the exact `main` commit produced by PR #5:

- `50e7f6b3590910417741fc43500e37f4a7924bf2`

The full tracked repository was archived and reviewed from a separate branch and draft PR. The inventory contained 148 tracked files and four local frontend surfaces: Main, Settings, Debug Tools and Happ Setup.

## Confirmed defects

### Frontend lifecycle and failure states

- asynchronous Tauri event registration could resolve after a React surface unmounted and leak the listener;
- bootstrap, Settings load, Happ Setup load and initial Debug probe failures could leave an unusable or misleading loading state;
- native Settings and Happ Setup close actions could bypass unsaved-draft protection;
- Settings live UI updates could complete out of order;
- the main widget could trigger a redundant full refresh immediately after its startup refresh;
- failed window sizing and open/relaunch commands were not consistently surfaced or retried;
- the custom profile dropdown lacked native keyboard/select semantics;
- Connect remained actionable while the backend already reported `Connecting`;
- the clock continued scheduling updates when hidden;
- document language metadata did not follow live language changes;
- Debug Tools could retain a stale successful report after a failed probe;
- Debug Tools could be resized below a usable layout.

### Settings persistence and runtime side effects

- Settings could be reported as persisted even when Windows autostart or always-on-top application failed;
- rollback after a persistence failure was incomplete;
- invalid loaded values were normalized inconsistently and were not bounded uniformly;
- autostart removal ignored registry failures;
- rapid main-window move/resize events wrote the settings file repeatedly;
- runtime window API failures were silently discarded in multiple startup, tray and close paths.

### Client and process isolation

- Happ refresh, toggle, open, diagnostics and setup operations were not serialized;
- an explicit Happ installation could observe or control another running installation;
- a stale configured Happ path prevented the setup screen from discovering an available installation;
- opening Happ could launch a duplicate instead of activating the exact configured instance;
- newly launched Happ did not use its installation directory as the working directory;
- existing Happ window activation did not verify visibility/focus;
- candidate probing used persisted settings instead of the unsaved candidate shown in Happ Setup;
- `Connecting` was downgraded to `Unknown` by status resolution.

### Screen and accessibility behavior

- several buttons relied on implicit form-button behavior;
- loading and notice regions were not consistently announced;
- v2rayN path radios were not one keyboard radio group;
- the Happ path placeholder was not localized;
- client/profile selectors lacked complete labels and an obvious Happ setup entry point;
- native-close discard confirmation could be bypassed if event delivery failed.

## Implemented corrections

- added safe async Tauri listener binding and regression tests;
- added a serialized frontend task queue for live UI settings;
- added explicit retry/error/empty states across all four local surfaces;
- routed native Settings/Happ close requests through draft-aware frontend confirmation and leave windows visible on delivery failure;
- replaced the custom profile menu with a labelled native select;
- added labelled client selection and a direct Happ configuration action;
- disabled connect while already connecting, stopped hidden clock timers and synchronized `<html lang>`;
- made Debug probe state authoritative and bounded the resizable debug window;
- normalized settings centrally, bounded endpoint lists and poll/opacity values, and preserved safe public-network defaults;
- made runtime settings application transactional with rollback before/after persistence failures;
- propagated registry and window API errors;
- debounced main-window position persistence with revision checks;
- serialized Happ operations and scoped process/window discovery to the configured executable;
- separated UI path discovery from fail-closed operational path selection;
- activated exact running Happ/v2rayN installations instead of launching duplicates;
- launched applications from their installation directory;
- added candidate-specific Happ probing and preserved `Connecting` status;
- added focused regression coverage for deterministic lifecycle, screen, settings and client-isolation behavior.

## Verification gate

The final PR head must pass the permanent Release Quality workflow:

1. reproducible frontend installation;
2. high-severity dependency audit;
3. complete Vitest suite and TypeScript/Vite production build;
4. complete Rust workspace formatting;
5. locked Rust unit/regression tests;
6. strict Clippy with warnings denied;
7. locked Rust check;
8. portable Windows release build and artifact verification;
9. clean frontend reinstall for packaging;
10. real Tauri/NSIS build and installer artifact verification.

## Residual runtime limitations

Windows UI Automation remains dependent on the installed client version, desktop session and privilege isolation. Control remains opt-in, exact-process scoped and fail-closed. Hosted CI cannot interactively validate every future v2rayN or Happ UI release.

Cross-process transactional locking is not exposed by either external client. The widget serializes its own operations and uses guarded file replacement, but cannot create a transaction spanning another application's independent writes.
