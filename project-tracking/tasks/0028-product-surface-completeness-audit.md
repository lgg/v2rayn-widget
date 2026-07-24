# 0028 - Product Surface Completeness Audit

## Status

In progress.

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
- network diagnostics safety;
- frontend/backend contract and localization consistency;
- stale project-tracking claims from earlier audits.

## Confirmed findings

1. Settings initial-load failure has no Retry action despite the documented four-screen retry/error guarantee.
2. Happ Setup initial-load failure has no Retry action despite the same guarantee.
3. `Unknown` connection state is rendered as `OFF`, misleading users by collapsing unknown and disconnected states.
4. auxiliary-window close hides the source window before proving that Main can be restored, allowing a failure path with no visible application window.
5. fixed-size and dynamically resized windows are not fitted to monitor work areas, so taskbars, DPI scaling or monitor changes can leave controls off-screen.
6. task/report 0018 still describe final verification and merge as incomplete although later work superseded them.

## Acceptance criteria

- [ ] All four local screens expose truthful loading/error/retry or no-result states.
- [ ] Unknown and disconnected connection states are visually distinct.
- [ ] Closing an auxiliary window cannot hide it before Main restoration succeeds.
- [ ] Main, Settings, Debug, Happ Setup and Diagnostics fit the active monitor work area when shown or resized.
- [ ] Every fix has frontend or Rust regression coverage where deterministic automation is possible.
- [ ] English and Russian labels remain complete and consistent.
- [ ] README and tracking records match the implemented capability boundary.
- [ ] Frontend audit/tests/build pass.
- [ ] Rust fmt/tests/strict Clippy/check/release build pass on the exact final PR head.
- [ ] PR is merged into `main`.

## Residual boundaries

- Real v2rayN/Happ automation still requires the corresponding Windows applications and installed UI versions.
- Happ UI Automation remains explicitly experimental and must continue to fail closed.
- Subscription operations remain unsupported/research-required as declared.
