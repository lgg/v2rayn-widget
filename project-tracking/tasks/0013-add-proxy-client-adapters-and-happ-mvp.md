# 0013 - Add Proxy Client Adapters and Happ MVP

## Metadata

| Field | Value |
| --- | --- |
| Status | In Progress |
| Priority | P1 |
| Type | architecture / feature |
| Created | 2026-07-18 |
| Labels | adapters, v2rayn, happ, tauri, frontend |
| Public redaction | Required before commit/update |

## Context

The project is currently implemented as a v2rayN-specific widget. Its frontend is reusable, but backend commands, settings, status fields and UI labels directly assume v2rayN, TUN mode and profiles.

The product must support selecting v2rayN, Happ and future proxy/VPN desktop applications through explicit adapters.

## Goal

Introduce a real adapter boundary, preserve current v2rayN functionality, expose accurate capabilities, add user-selectable client configuration and begin a safe Happ integration.

## Scope

Included:

- shared proxy client models;
- adapter registry and descriptors;
- persisted selected client;
- compatibility-safe v2rayN adapter;
- generic Tauri commands and frontend API;
- client selector UX;
- capability-gated actions;
- initial Happ process detection/open/status adapter;
- documentation, roadmap and tests;
- explicit unsupported subscription capabilities.

Out of scope for this first task:

- reverse engineering undocumented Happ daemon IPC;
- mutating Happ internal config/database;
- claiming reliable Happ connect/disconnect before a control path is verified;
- v2rayN subscription list/switch/refresh/add/remove support;
- repository/application rename;
- Linux/macOS support.

## Current v2rayN Capability Baseline

Supported:

- detect/open/restart application;
- process/config/log status signals;
- external IP and latency checks;
- TUN toggle with UI Automation and config fallback;
- profile list;
- active profile switching, experimental;
- privilege diagnostics.

Unsupported:

- subscription listing;
- subscription switching;
- subscription refresh/update;
- subscription add/remove;
- generic subscription metadata.

## Initial Happ Capability Baseline

Targeted in this task:

- application descriptor;
- process detection;
- executable path from running process;
- optional manual executable path;
- open application;
- partial status and generic network diagnostics;
- accurate unsupported/research-required control capabilities.

Not targeted until research:

- connect/disconnect;
- active transport mode;
- server/profile list and selection;
- subscriptions;
- daemon restart/reload.

## Affected Areas

- `src/tauri/src/models/`
- `src/tauri/src/adapters/`
- `src/tauri/src/commands/`
- `src/tauri/src/main.rs`
- settings persistence
- frontend API/types/store/components
- EN/RU localization
- README and architecture docs
- project tracking

## Acceptance Criteria

- [ ] `selected_client` is persisted and defaults to v2rayN for existing settings.
- [ ] Backend exposes a catalog containing v2rayN and Happ.
- [ ] Each catalog entry includes accurate capabilities and maturity.
- [ ] Existing v2rayN users keep current behavior by default.
- [ ] Current v2rayN integration is reachable through a dedicated adapter boundary.
- [ ] Legacy v2rayN commands remain available during migration.
- [ ] Frontend lets the user choose v2rayN or Happ.
- [ ] UI clears stale profiles/status after switching clients.
- [ ] Unsupported Happ controls are disabled or return explicit unsupported errors.
- [ ] Happ process existence alone never produces a false Connected state.
- [ ] v2rayN subscription capabilities are explicitly unsupported.
- [ ] Documentation describes actual implementation and remaining research.
- [ ] Public redaction review passes.

## Verification Plan

- [ ] Rust formatting and compile check.
- [ ] Rust unit tests.
- [ ] Frontend type check/tests/build.
- [ ] Existing v2rayN resolver regression tests.
- [ ] Adapter registry/default settings tests.
- [ ] Manual Windows validation: existing v2rayN flow.
- [ ] Manual Windows validation: Happ process detection/open.
- [ ] Manual UI validation: switch adapters and capability-gated controls.
- [ ] Documentation consistency review.
- [ ] Public redaction review.

## Questions and Decisions

| Question | Status | Answer / Decision |
| --- | --- | --- |
| Should unsupported functions be hidden or fail at runtime? | Decided | UI hides/disables them; backend also rejects unsupported calls. |
| Should the old v2rayN commands be removed immediately? | Decided | No. Keep compatibility wrappers during staged migration. |
| Can Happ running process mean Connected? | Decided | No. Use Unknown/partial until a reliable internal signal exists. |
| Are profiles and subscriptions the same abstraction? | Decided | No. Subscriptions will be modeled separately. |
| Does v2rayN currently support subscription switching? | Decided | No; explicitly unsupported. |

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Large command module makes extraction risky | High | Add adapter boundary and compatibility wrappers incrementally |
| Persisted settings schema changes | High | Use serde defaults and v2rayN migration default |
| Happ executable/process naming differs by version | Medium | Multiple candidates, path validation and manual override |
| Generic UI leaks v2rayN-specific terms | Medium | Add generic types/actions and migrate labels |
| Unsupported capabilities accidentally shown | High | Backend descriptors plus frontend gating |

## Links

- Roadmap: `project-tracking/roadmap/0013-proxy-client-adapter-roadmap.md`
- Decision: `project-tracking/decisions/0013-multi-client-adapter-architecture.md`
- Existing subscription QA task: `project-tracking/tasks/0011-build-subscription-mode-profile-switch-validation-matrix.md`
