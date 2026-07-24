# 0028 - Product Surface Completeness Audit

## Status

Implementation and deterministic product verification complete; final exact-head Release Quality and merge pending.

## Context

The release and installer boundary was completed through tasks 0026-0027. This task independently audits every product claim, user-facing screen and declared adapter capability against the current frontend and Rust/Tauri implementation.

## Scope

- Main dashboard and compact/full layout behavior;
- Settings, Debug Tools and Happ Setup windows;
- client and profile selection;
- v2rayN and Happ capability gating;
- loading, empty, error, retry and unsaved-draft states;
- tray/window lifecycle and multi-monitor behavior;
- settings persistence and live UI updates;
- network diagnostics safety and remote IPC isolation;
- frontend/backend contract and localization consistency;
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

## Acceptance criteria

- [x] All four local screens expose truthful loading/error/retry or no-result states.
- [x] Unknown and disconnected connection states are visually distinct.
- [x] Closing any auxiliary window restores Main before hiding the source.
- [x] Main, Settings, Debug, Happ Setup and Diagnostics fit the active monitor work area when shown or resized.
- [x] Decorated-window fitting accounts for the measured frame/title-bar size.
- [x] Constrained Main content remains vertically scrollable.
- [x] Every deterministic repository-controlled fix has frontend or Rust regression coverage.
- [x] English and Russian catalogs have exact key parity and no blank values.
- [x] Remote Diagnostics is excluded from the default Tauri IPC capability by a permanent contract test.
- [x] README and historical tracking records match the implemented capability boundary.
- [x] Frontend contracts, npm audit, tests and production build pass on implementation head `95bb525820ed155e923dc572cbf57b9e727279f4` in Release Quality #329 (`30102240110`).
- [x] Rust fmt, complete tests, strict all-targets Clippy, strict release Clippy and locked check pass on that implementation head.
- [ ] One clean exact-head Release Quality completes the portable build, artifacts and cleanup after the self-hosted runner is available again.
- [ ] PR #17 is squash-merged into `main`.

## Verification interruption

The first portable release link in Release Quality #329 ended when the self-hosted Rust job disappeared without a normal step conclusion, job log or Rust diagnostics artifact. A same-SHA retry remained queued because the dedicated runner was unavailable. This is recorded as infrastructure interruption, not as a successful release build and not as a product-code failure.

## Residual boundaries

- Real v2rayN/Happ UI Automation still requires the corresponding Windows applications, visible interactive session and compatible installed UI versions.
- v2rayN profile switching remains experimental.
- Happ UI Automation remains explicit opt-in experimental and continues to fail closed on ambiguous controls, insufficient confidence or UIPI mismatch.
- v2rayN subscriptions remain unsupported; Happ profiles/restart/subscriptions remain research-required.
- Diagnostics can load a user-configured HTTP(S) page but receives no default Tauri IPC capability.
- Automated work-area/layout contracts do not replace screenshot comparison across every DPI, font renderer and GPU combination.

## Related report

- `project-tracking/reports/0028-product-surface-completeness-audit-report.md`
- PR #17
