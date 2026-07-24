# 0028 - Product Surface Completeness Audit

## Status

Completed and squash-merged through PR #17.

## Context

The release and installer boundary was completed through tasks 0026-0027. This task independently audited every product claim, user-facing screen and declared adapter capability against the frontend and Rust/Tauri implementation.

## Scope

- Main dashboard and compact/full layout behavior;
- Settings, Debug Tools and Happ Setup windows;
- client and profile selection;
- v2rayN and Happ capability gating;
- loading, empty, error, retry and unsaved-draft states;
- tray/window lifecycle and multi-monitor behavior;
- settings persistence and live UI updates;
- network diagnostics safety and remote IPC isolation;
- frontend/backend contract, localization and strict build hygiene;
- stale project-tracking claims from earlier audits.

## Confirmed findings

1. Settings initial-load failure had no Retry action despite the documented four-screen retry/error guarantee.
2. Happ Setup initial-load failure had no Retry action.
3. `Unknown` connection state was rendered as `OFF`, collapsing unknown and confirmed disconnected states.
4. auxiliary-window close hid the source window before proving that Main could be restored.
5. native Debug close bypassed the safe common close path.
6. fixed-size and dynamically resized local windows were not fitted to monitor work areas.
7. reopening an existing Diagnostics window skipped work-area fitting.
8. decorated Diagnostics fitting used an outer-size target directly as a client-size request.
9. constrained Main windows clipped lower controls because the populated surface used `overflow-hidden`.
10. EN/RU catalog parity was not protected by a permanent regression test.
11. the remote Diagnostics IPC boundary was correct but not protected by a permanent contract.
12. task/report 0018 still described completed follow-up work as pending.
13. `client_commands.rs` retained an unused `Manager` import and failed both strict Clippy configurations.
14. the new window-position code was not rustfmt-clean.

## Acceptance criteria

- [x] All four local screens expose truthful loading/error/retry or no-result states.
- [x] Unknown and disconnected connection states are visually distinct.
- [x] Closing any auxiliary window restores Main before hiding the source.
- [x] Main, Settings, Debug, Happ Setup and Diagnostics fit the active monitor work area when shown or resized.
- [x] Decorated-window fitting accounts for the measured frame/title-bar size.
- [x] Constrained Main content remains vertically scrollable.
- [x] Every deterministic repository-controlled product fix has frontend or Rust regression coverage.
- [x] English and Russian catalogs have exact key parity and no blank values.
- [x] Remote Diagnostics is excluded from the default Tauri IPC capability by a permanent contract test.
- [x] README and historical tracking records match the implemented capability boundary.
- [x] Frontend contracts, npm audit, tests and production build pass.
- [x] Rust fmt, unit/integration tests, both strict Clippy configurations, locked check and portable release build pass.
- [x] Hidden strict Clippy and rustfmt failures were recovered from uploaded diagnostics and corrected rather than ignored.
- [x] Temporary patch workflows were removed from the branch.
- [x] One clean exact-head Release Quality completed fmt, tests, both strict Clippy configurations, locked check, portable build, artifacts and cleanup.
- [x] PR #17 was squash-merged into `main`.

## Final verification evidence

Release Quality #336 (`30105332510`) completed successfully on exact PR head `e6dc07a384e1705f17008430392b3c6f49bc55f6`.

Both jobs passed completely:

- `frontend`: workflow contracts, locked dependency restore, Tauri/NSIS prerequisite validation, npm audit, complete tests, production build, artifacts and cleanup;
- `rust-windows`: Rust/MSVC prerequisite validation, rustfmt, complete tests, strict all-targets Clippy, strict release/no-default-features Clippy, locked Cargo check, portable release build, artifacts, diagnostics and cleanup.

PR #17 was squash-merged into `main` as commit `1b848318a92f2e3b0456d53d7e40c1343964ff56`.

## Verification history

Release Quality #329 (`30102240110`) first encountered an infrastructure interruption during portable linking. The dedicated runner disappeared without a normal log or diagnostics artifact.

Release Quality #331 (`30104073460`) later completed the portable build and uploaded the executable and Rust diagnostics. Its aggregate failure correctly revealed an unused import and rustfmt diff hidden behind continue-on-error steps. Both repository defects were then fixed.

Release Quality #336 (`30105332510`) was the final clean exact-head acceptance run and completed successfully.

## Residual boundaries

- Real v2rayN/Happ UI Automation still requires corresponding Windows applications, a visible interactive session and compatible installed UI versions.
- v2rayN profile switching remains experimental.
- Happ UI Automation remains explicit opt-in experimental and fails closed on ambiguous controls, insufficient confidence or UIPI mismatch.
- v2rayN subscriptions remain unsupported; Happ profiles/restart/subscriptions remain research-required.
- Diagnostics can load a user-configured HTTP(S) page but receives no default Tauri IPC capability.
- Automated work-area/layout contracts do not replace screenshot comparison across every DPI, font renderer and GPU combination.

## Related report

- `project-tracking/reports/0028-product-surface-completeness-audit-report.md`
- PR #17
