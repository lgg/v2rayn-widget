# 0013 - Add Proxy Client Adapters and Happ MVP

## Metadata

| Field | Value |
| --- | --- |
| Status | Completed |
| Priority | P1 |
| Type | architecture / feature |
| Created | 2026-07-18 |
| Completed | 2026-07-18 |
| Labels | adapters, v2rayn, happ, tauri, frontend |
| Public redaction | Passed |

## Goal

Replace the v2rayN-only application boundary with a real operational adapter architecture, preserve existing v2rayN behavior, expose accurate capabilities, allow selecting the target client and add a safe Happ baseline plus explicitly opt-in experimental connection control.

## Completed Scope

- shared client, capability, transport and diagnostics models;
- operational `ProxyClientAdapter` contract and compile-time registry;
- generic backend dispatcher without v2rayN/Happ branching;
- migration-safe persisted selected client;
- v2rayN compatibility adapter and legacy command wrappers;
- client selector and capability-gated frontend;
- Happ process/path detection and application launch;
- dedicated Happ Setup and diagnostics window;
- opt-in Windows UI Automation connect/disconnect MVP;
- fail-closed action classifier with confidence threshold;
- EN/RU localization;
- Windows quality workflow and diagnostic artifacts;
- roadmap, decision, architecture, README and final report.

## Capability Result

### v2rayN

Supported:

- detect/open/restart;
- process/config/log status;
- IP and latency checks;
- TUN toggle with UI Automation and fallback;
- profile list;
- experimental profile selection;
- privilege diagnostics.

Explicitly unsupported:

- subscription list;
- subscription switch;
- subscription refresh/update;
- subscription add/remove/manage;
- generic subscription metadata.

### Happ

Supported baseline:

- process/PID detection;
- executable detection and validation;
- application open;
- network diagnostics;
- dedicated runtime probe.

Experimental and disabled by default:

- connection-state inference from explicit Connect/Disconnect UI action;
- connect/disconnect click through PID-scoped Windows UI Automation;
- exact selected Proxy/TUN/Mixed label reading when exposed by the current UI.

Not implemented or claimed:

- stable official CLI/API/daemon IPC;
- server/profile list and selection;
- restart/reload;
- subscriptions;
- internal config/database mutation.

## Acceptance Criteria

- [x] Existing settings default to v2rayN.
- [x] Backend catalog contains v2rayN and Happ with explicit capabilities.
- [x] Adapter contract owns refresh/toggle/list/select/open/diagnostics operations.
- [x] Generic command dispatcher has no per-client operation branching.
- [x] Legacy v2rayN commands remain available.
- [x] User can select and persist v2rayN or Happ.
- [x] Switching clears stale status/items.
- [x] Unsupported controls are disabled in UI and rejected by backend.
- [x] v2rayN subscription operations are explicitly unsupported.
- [x] Happ process existence alone never produces Connected.
- [x] Happ path can be detected, entered and validated in UI.
- [x] Happ experimental control requires explicit persisted consent.
- [x] Happ UI Automation targets only the detected process and fails closed on ambiguous controls.
- [x] No Happ config/database/subscription mutation is performed.
- [x] Adapter-specific diagnostics are available for target-machine validation.
- [x] Automated Windows tests/build/check pass.
- [x] Public redaction review passes.

## Verification

Automated:

- frontend component/unit tests, including Happ Setup and diagnostics;
- TypeScript/Vite production build;
- changed Rust source formatting check;
- Rust unit and existing v2rayN regression suite;
- `cargo check --locked` with frontend distribution;
- settings migration tests;
- adapter registry/capability tests;
- Happ classifier tests for Connect/Disconnect, ambiguous labels and transport labels.

Runtime validation is intentionally version-sensitive rather than hardcoded into the release claim. The Happ Setup probe exposes all information needed to verify the installed version; control remains disabled until the user explicitly enables it and fails closed if the expected UI is absent.

## Decisions

| Question | Decision |
| --- | --- |
| Remove old v2rayN commands now? | No; preserve compatibility until a separate removal task. |
| Infer Happ Connected from process? | Never. |
| Mutate Happ internal config/database? | No. |
| Treat profiles as subscriptions? | No; subscriptions remain a separate future abstraction. |
| Add Happ control without documented API? | Only opt-in experimental PID-scoped UI Automation with a strict confidence threshold. |
| Keep this task blocked by every possible future adapter/subscription feature? | No; those are separate roadmap phases. |

## Links

- Roadmap: `project-tracking/roadmap/0013-proxy-client-adapter-roadmap.md`
- Decision: `project-tracking/decisions/0013-multi-client-adapter-architecture.md`
- Report: `project-tracking/reports/0013-add-proxy-client-adapters-and-happ-mvp-report.md`
- Subscription QA: `project-tracking/tasks/0011-build-subscription-mode-profile-switch-validation-matrix.md`
