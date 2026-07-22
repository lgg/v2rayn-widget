# 0016 - Post-Merge Runtime Hardening

## Metadata

| Field | Value |
| --- | --- |
| Status | Done |
| Priority | P1 |
| Type | post-merge audit / runtime hardening |
| Created | 2026-07-22 |
| Completed | 2026-07-22 |
| Labels | audit, v2rayn, config, processes, privileges, tauri, tests |
| Public redaction | Passed |

## Context

PR #3 was squash-merged into `main` as `4ed1b9a42ea164d4b1201131d76e94752ad4591d`. This task independently audited that exact merged tree and focused on runtime failure modes not fully exercised by build-only verification.

## Scope

- external v2rayN config ownership and recovery behavior;
- process selection and restart correctness with multiple installations;
- Windows UI Automation and privilege diagnostics scoped to the selected v2rayN instance;
- application launch working directory;
- startup window behavior;
- regression tests, full Release Quality workflow and public redaction.

## Confirmed Findings and Fixes

- observational status reads restored a backup over an existing invalid external `guiNConfig.json`; reads now use a valid backup without modifying the primary file;
- mutation paths could overwrite an external config change prepared after the initial read; guarded replacement now rejects concurrent changes;
- mutation paths could use a valid backup to replace a corrupt primary; mutations now require a valid primary and fail closed;
- process termination was reported as successful even when the operating-system kill request failed; termination errors now propagate;
- restart launched a new instance without confirming that the matched process had exited; restart now refuses to launch a duplicate;
- v2rayN was launched without its installation directory as the working directory; launch context is now explicit and tested;
- UIPI diagnostics and UI Automation could target the first v2rayN process/window instead of the configured installation; control now follows configured path → exact PID → exact window and fails closed;
- startup forced every Tauri window to non-resizable; main/debug resizability now matches the declared Tauri configuration.

## Acceptance Criteria

- [x] Status reads never overwrite an existing external v2rayN config.
- [x] Mutations fail closed when the primary external config is corrupt or changes concurrently.
- [x] Restarts report success only after a matched process actually terminates.
- [x] v2rayN launches with its installation directory as the working directory.
- [x] UIPI checks and UI Automation use the process belonging to the selected installation.
- [x] Startup window resizability matches the Tauri configuration.
- [x] Focused regression tests cover confirmed defects where deterministic testing is possible.
- [x] Frontend and full Windows Release Quality workflow pass on the final head before merge.
- [x] README, architecture documentation and the completion report match the verified implementation.
- [x] Temporary audit workflows and payloads are absent from the final diff.
- [x] PR #4 is squash-merged into `main` only after the final head is green.

## Verification

The permanent `Release Quality` workflow validates:

1. clean frontend dependency installation from the lockfile;
2. high-severity dependency audit;
3. frontend tests and production build;
4. complete Rust workspace formatting;
5. locked Rust tests;
6. strict Clippy with warnings denied;
7. locked Rust check;
8. portable Windows release build and artifact verification;
9. clean frontend reinstall for packaging;
10. real Tauri NSIS build and installer artifact verification.

## Residual Runtime Risks

- Windows UI Automation remains version-, desktop-session- and privilege-sensitive; control is now exact-PID scoped and fail-closed, but every future v2rayN UI version still requires interactive compatibility validation.
- Cross-process config locking is not available through the current v2rayN contract. Compare-before-replace prevents normal concurrent edits from being silently overwritten but cannot create a fully transactional external-file update.

## Links

- Baseline hardening PR: `#3`
- Post-merge runtime hardening PR: `#4`
- Completion report: `project-tracking/reports/0016-post-merge-runtime-hardening-report.md`
