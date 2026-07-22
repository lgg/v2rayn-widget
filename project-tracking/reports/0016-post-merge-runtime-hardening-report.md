# 0016 - Post-Merge Runtime Hardening Report

## Audited baseline

The audit started from the exact squash-merged `main` commit produced by PR #3:

- `4ed1b9a42ea164d4b1201131d76e94752ad4591d`

The implementation was performed in a separate branch and PR so the post-merge review did not validate its own unmerged tree.

## Confirmed defects

### External config ownership

Observational status reads could restore `guiNConfig.json.bak` over an existing invalid `guiNConfig.json`. A widget status refresh therefore had the ability to mutate a file owned by v2rayN.

Mutation operations also trusted the content read at the start of the operation and could overwrite an external edit made before the atomic replace.

### Multiple v2rayN installations

Process, privilege and UI-window discovery were not consistently tied to the configured installation. With two v2rayN installations running, a control action could inspect or automate the wrong process/window.

### Restart correctness

The old termination helper returned success after finding a matching process even when the operating-system kill request failed. Restart then launched a new process without verifying that the matched instance had exited.

### Launch context

`v2rayN.exe` was launched without setting the installation directory as its working directory. Applications that resolve relative resources from the current directory could start incorrectly.

### Window configuration

Startup code forced every Tauri window to be non-resizable, overriding the declared resizable behavior of the main and debug windows.

## Implemented corrections

- status reads may use a valid backup for observation but never replace an existing primary config;
- config mutations require a valid primary file and fail closed on corruption;
- guarded replacement rejects concurrent external changes before writing;
- process discovery exposes the PID belonging to the selected installation;
- privilege diagnostics accept that exact PID instead of selecting the first process by name;
- v2rayN UI Automation accepts that PID and refuses to act when the exact window is unavailable;
- termination errors are propagated;
- restart verifies that the matched process exited before launching another instance;
- launches use the selected installation as the working directory;
- startup window resizability now matches the Tauri configuration.

## Regression coverage

Focused tests cover:

- backup observation without primary-file overwrite;
- mutation rejection for a corrupt primary config;
- guarded-update rejection after an external change;
- selected executable and working directory construction;
- startup resizability for main, settings, debug and Happ setup windows;
- existing config, profile, status, network-safety and adapter behavior.

## Verification gate

The final PR head must pass the permanent `Release Quality` workflow:

1. reproducible frontend install;
2. high-severity dependency audit;
3. frontend tests and production build;
4. complete Rust workspace formatting check;
5. locked Rust tests;
6. strict Clippy with warnings denied;
7. locked Rust check;
8. portable Windows release build and artifact verification;
9. clean frontend reinstall for packaging;
10. real Tauri NSIS build and installer artifact verification.

## Residual risks

Windows UI Automation remains sensitive to installed v2rayN versions, window structure, desktop session and privilege isolation. The implementation now fails closed and is scoped to the configured process, but interactive validation against every v2rayN release is not achievable in hosted CI.

External applications can still change their config immediately after the guarded comparison and before the atomic replace. The in-process lock plus compare-before-replace substantially narrows the race and prevents normal concurrent edits from being silently overwritten, but cross-process transactional locking is not available through the current v2rayN contract.
