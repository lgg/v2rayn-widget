# 0013 - Add Proxy Client Adapters and Happ MVP

## Metadata

| Field | Value |
| --- | --- |
| Status | In Progress |
| Priority | P1 |
| Type | architecture / feature |
| Created | 2026-07-18 |
| Labels | adapters, v2rayn, happ, tauri, frontend |
| Public redaction | Reviewed for current PR |

## Context

The project was implemented as a v2rayN-specific widget. Its frontend is reusable, but backend commands, settings, status fields and UI labels directly assumed v2rayN, TUN mode and profiles.

The product must support selecting v2rayN, Happ and future proxy/VPN desktop applications through explicit adapters.

## Goal

Introduce a real adapter boundary, preserve current v2rayN functionality, expose accurate capabilities, add user-selectable client configuration and begin a safe Happ integration.

## Scope

Included:

- shared proxy client models;
- `ProxyClientAdapter` trait and adapter registry;
- persisted selected client;
- compatibility-safe v2rayN adapter;
- generic Tauri commands and frontend API;
- client selector UX;
- capability-gated actions;
- initial Happ process detection/open/status adapter;
- documentation, roadmap, report and tests;
- explicit unsupported subscription capabilities;
- Windows quality workflow.

Out of scope for this first task:

- reverse engineering undocumented Happ daemon IPC;
- mutating Happ internal config/database;
- claiming reliable Happ connect/disconnect before a control path is verified;
- v2rayN subscription list/switch/refresh/add/remove support;
- repository/application rename;
- Linux/macOS support.

## Current v2rayN Capability Baseline

Supported in the existing implementation:

- detect/open/restart application;
- process/config/log status signals;
- external IP and latency checks;
- TUN toggle with UI Automation and config fallback;
- profile list;
- active profile switching, experimental;
- privilege diagnostics.

Explicitly unsupported:

- generic transport-mode reporting;
- subscription listing;
- subscription switching;
- subscription refresh/update;
- subscription add/remove;
- generic subscription metadata.

## Initial Happ Capability Baseline

Implemented in this task:

- application descriptor;
- process detection;
- executable path from running process;
- optional persisted manual executable path field;
- common Windows install-path detection;
- path detect/validate backend commands and frontend API;
- open application;
- partial status and generic network diagnostics;
- accurate research-required control capabilities;
- conservative Unknown status while process is running.

Not targeted until research:

- connect/disconnect;
- reliable active connection state;
- active transport mode;
- server/profile list and selection;
- subscriptions;
- daemon restart/reload;
- settings-window editor for the optional Happ path.

## Affected Areas

- `src/tauri/src/models/`
- `src/tauri/src/adapters/`
- `src/tauri/src/client_commands.rs`
- `src/tauri/src/main.rs`
- settings persistence
- frontend API/types/store/components
- EN/RU localization
- README and architecture docs
- project tracking
- Windows CI

## Acceptance Criteria

- [x] `selected_client` is persisted and defaults to v2rayN for existing settings.
- [x] Backend exposes a catalog containing v2rayN and Happ.
- [x] Each catalog entry includes explicit capabilities and maturity.
- [x] Existing settings select v2rayN by default.
- [x] Current v2rayN integration is reachable through a dedicated adapter boundary.
- [x] Legacy v2rayN commands remain available during migration.
- [x] Frontend lets the user choose v2rayN or Happ.
- [x] UI clears stale profiles/status after switching clients.
- [x] Unsupported Happ controls are disabled and rejected by backend commands.
- [x] Happ process existence alone never produces a Connected state.
- [x] v2rayN subscription capabilities are explicitly unsupported.
- [x] Documentation describes actual implementation and remaining research.
- [x] Public redaction review passes for the current diff.
- [ ] Existing v2rayN behavior is regression-tested manually on a real Windows machine.
- [ ] Happ detection/open is validated against an installed Happ version.

## Verification Plan

- [x] Changed Rust source formatting check.
- [x] Rust unit tests: 26 passed.
- [x] Rust compile check: `cargo check --locked` passed.
- [x] Frontend tests: 11 passed.
- [x] Frontend production build passed.
- [x] Existing v2rayN resolver regression tests passed in the Rust suite.
- [x] Adapter registry/default settings tests passed.
- [ ] Manual Windows validation: existing v2rayN flow.
- [ ] Manual Windows validation: Happ process detection/open.
- [ ] Manual UI validation: switch adapters and capability-gated controls.
- [x] Documentation consistency review.
- [x] Public redaction review.

## Questions and Decisions

| Question | Status | Answer / Decision |
| --- | --- | --- |
| Should unsupported functions be hidden or fail at runtime? | Decided | UI hides/disables them; backend also rejects unsupported calls. |
| Should the old v2rayN commands be removed immediately? | Decided | No. Keep compatibility wrappers during staged migration. |
| Can Happ running process mean Connected? | Decided | No. Use Unknown/partial until a reliable internal signal exists. |
| Are profiles and subscriptions the same abstraction? | Decided | No. Subscriptions will be modeled separately. |
| Does v2rayN currently support subscription switching? | Decided | No; explicitly unsupported. |
| Is this PR ready to merge without Windows validation? | Decided | No. Keep it as draft. |

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Large legacy command module makes extraction risky | High | Compatibility adapter and staged extraction |
| Persisted settings schema changes | High | Serde defaults and v2rayN migration default |
| Happ executable/process naming differs by version | Medium | Multiple candidates, path validation and future manual UI |
| Generic UI leaks v2rayN-specific terms | Medium | Generic API/types/actions and selected-client labels |
| Unsupported capabilities accidentally shown | High | Backend descriptors plus frontend gating |
| Real Windows behavior differs from automated checks | High | Keep the PR draft until v2rayN and Happ manual validation is completed |

## Links

- Roadmap: `project-tracking/roadmap/0013-proxy-client-adapter-roadmap.md`
- Decision: `project-tracking/decisions/0013-multi-client-adapter-architecture.md`
- Report: `project-tracking/reports/0013-add-proxy-client-adapters-and-happ-mvp-report.md`
- Existing subscription QA task: `project-tracking/tasks/0011-build-subscription-mode-profile-switch-validation-matrix.md`
