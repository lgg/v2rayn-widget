# 0013 - Proxy Client Adapter Roadmap

## Purpose

Превратить текущий v2rayN-specific widget в расширяемый Windows desktop widget для нескольких proxy/VPN client applications.

Первый набор адаптеров:

- v2rayN - перенос текущей рабочей интеграции без потери существующих сценариев;
- Happ - поэтапная интеграция от безопасного read-only detection до управления подключением;
- future adapters - архитектурная возможность добавлять другие приложения без копирования frontend и общей Tauri-логики.

## Product Principles

1. Один общий интерфейс виджета, несколько client adapters.
2. Пользователь явно выбирает целевое приложение.
3. UI показывает только действия, заявленные adapter capabilities.
4. Неподдерживаемые функции не имитируются и не выдаются за работающие.
5. Legacy v2rayN behavior сохраняется до завершения миграции и покрывается compatibility wrappers.
6. Любой неофициальный IPC, config mutation или UI Automation path документируется как version-sensitive.
7. Публичный репозиторий не содержит реальных subscription URLs, proxy endpoints, локальных путей и runtime logs.

## Capability Model

Каждый адаптер должен публиковать capability descriptor.

Минимальные capabilities:

- detect application;
- read process state;
- read connection state;
- open application;
- connect/disconnect;
- list profiles/servers;
- select profile/server;
- restart application;
- read transport mode;
- manage subscriptions;
- read subscription metadata.

Capability states:

- `supported` - реализовано и является заявленной частью адаптера;
- `experimental` - реализовано, но требует дополнительной матрицы проверки;
- `unsupported` - отсутствует;
- `research_required` - реализация зависит от исследования API/IPC/config/UI.

## Current Baseline

### v2rayN adapter baseline

Current behavior to preserve:

- app/path detection;
- process monitoring;
- config reading;
- log reading;
- combined status resolution;
- external IP and latency checks;
- Enable TUN toggle through UI Automation;
- config mutation + reload/restart fallback;
- profile list reading;
- experimental active profile switching;
- open and restart application;
- privilege/UIPI diagnostics.

Explicit limitations:

- subscription switching is not supported;
- subscription listing/management is not supported;
- subscription refresh/update is not supported;
- profile switching inside subscription-driven setups remains experimental until task 0011 is completed;
- the adapter must not expose `manage_subscriptions` or `switch_subscription` as available capabilities.

### Happ adapter baseline

Known safe initial scope:

- process detection;
- executable path discovery from a running process;
- manual executable path configuration;
- open application;
- external connectivity/IP/latency diagnostics;
- explicit partial/unknown connection state when Happ internal state is unavailable.

Not yet confirmed:

- public CLI;
- public local API;
- supported daemon IPC contract;
- stable config/database format;
- safe connect/disconnect command;
- server/profile enumeration and selection;
- Proxy/TUN/Mixed transport state;
- subscription management.

Until confirmed, Happ control capabilities remain `research_required` or `unsupported`.

## Phase A - Architecture Boundary

Status: In Progress

Goals:

- Add shared client ID, descriptor, capabilities and transport mode models.
- Add an adapter registry/factory.
- Add generic commands for client catalog, current adapter, open, refresh, toggle and item selection.
- Keep old v2rayN Tauri commands as compatibility wrappers.
- Add selected client to persisted settings with v2rayN as migration-safe default.
- Add tests for serialization, defaults, adapter lookup and capabilities.

Acceptance criteria:

- Existing settings load without migration failure.
- Existing v2rayN users continue to receive v2rayN behavior by default.
- Frontend can ask backend which client is selected and which actions are available.
- Unsupported adapter actions return an explicit typed/structured error message.

## Phase B - v2rayN Adapter Extraction

Status: In Progress

Goals:

- Move v2rayN-specific detection, status, profile and control orchestration behind `V2RayNAdapter`.
- Keep low-level services reusable where practical.
- Replace direct frontend assumptions with generic calls.
- Preserve existing debug tools as v2rayN-only diagnostics.
- Mark profile switching experimental.
- Mark all subscription capabilities unsupported.

Acceptance criteria:

- Current v2rayN control flow remains functionally equivalent.
- Existing command names remain available during migration.
- New generic command path reaches the v2rayN adapter.
- v2rayN capabilities accurately describe current implementation.

## Phase C - Client Selection UX

Status: In Progress

Goals:

- Add client selector to the widget/settings UX.
- Persist selected client.
- Refresh status and available items immediately after selection.
- Replace labels such as `open v2rayN` with selected-client-aware text.
- Hide/disable profile selector and connect button when unsupported.
- Show a clear integration maturity badge/note for Happ.

Acceptance criteria:

- User can choose v2rayN or Happ without editing a config file.
- Selection survives restart.
- Switching adapters does not reuse stale profile/status data.
- Unsupported controls are not clickable.

## Phase D - Happ Read-Only MVP

Status: In Progress

Goals:

- Detect common Happ desktop process names safely.
- Discover executable path from a running process.
- Allow manual executable selection/path.
- Open Happ.
- Expose process state and generic network diagnostics.
- Report connection state as partial/unknown unless a reliable Happ signal is found.

Acceptance criteria:

- Widget can select Happ and report whether the desktop application is running.
- Widget can open Happ from a validated path.
- No Happ config/database mutation occurs.
- No false `Connected` state is inferred only from process existence.

## Phase E - Happ Integration Research

Status: Planned

Research order:

1. Official/documented CLI or local API.
2. Stable daemon IPC exposed by installed application.
3. Read-only config/database inspection.
4. Windows UI Automation or tray-menu automation.

Deliverables:

- redacted protocol/process/filesystem research report;
- version matrix;
- security and compatibility assessment;
- decision selecting the supported control path;
- follow-up implementation tasks.

Exit criteria:

- connect/disconnect can be implemented without guessing;
- status source is more reliable than process + external health checks;
- version-sensitive paths have detection and graceful fallback.

## Phase F - Happ Control MVP

Status: Planned

Possible scope after research:

- connect/disconnect;
- read Proxy/TUN/Mixed mode;
- read active server/profile;
- list and select servers/profiles;
- restart/reload where safe.

Subscription operations remain a separate phase and are not implied by server/profile support.

## Phase G - Subscription Abstraction

Status: Planned

Goals:

- Define a separate subscription model instead of treating subscriptions as profiles.
- Add capabilities for list, active subscription, refresh, switch, add/remove and metadata.
- Implement only where the target client provides a safe supported path.

v2rayN status at roadmap creation:

- list subscriptions: unsupported;
- switch subscription: unsupported;
- refresh subscription: unsupported;
- add/remove subscription: unsupported.

Happ status at roadmap creation:

- all subscription capabilities: research required.

## Phase H - Additional Adapters

Status: Planned

Candidate onboarding checklist:

- document application versions/platforms;
- identify stable control and status sources;
- implement descriptor/capabilities first;
- add detection and read-only status;
- add control only after reliability review;
- add adapter-specific tests and docs;
- do not leak app-specific fields into shared frontend contracts unless generalized.

## Generic Data Model Target

Suggested shared status fields:

- `client_id`;
- `client_name`;
- `connection_state`;
- `transport_mode`;
- `active_item_name`;
- `external_ip`;
- `latency_ms`;
- `last_error`;
- `last_event`;
- `capabilities`;
- `updated_at`.

Compatibility aliases such as `tun_enabled` and `active_profile_name` may remain during migration but should not be required by future adapters.

## Testing Strategy

- Rust unit tests for model serialization/defaults and registry dispatch.
- v2rayN regression tests for existing status resolver and config operations.
- Happ process-name/path tests using pure helper functions where possible.
- frontend tests for selector, capability-gated controls and adapter switching.
- manual Windows matrix for privilege levels, installed/portable clients and app versions.
- CI/build validation where available; unavailable checks must be documented in the report.

## Release Strategy

1. Land architecture and compatibility layer without changing default behavior.
2. Land client selector and Happ read-only MVP behind accurate capability gating.
3. Validate v2rayN regression behavior on a real Windows environment.
4. Validate Happ detection/open behavior on a real Windows environment.
5. Research and land Happ control separately.
6. Rename product/repository only after multi-client behavior is stable; renaming is not part of the initial adapter PR.

## Open Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Existing frontend assumes TUN/profile semantics | High | Keep compatibility aliases and migrate incrementally |
| Happ daemon IPC is private or unstable | High | Prefer official API; otherwise document version matrix and fallback |
| Process running is mistaken for VPN connected | High | Never infer connected from process alone |
| UI Automation breaks after app updates | Medium | Capabilities, runtime probes, version notes and graceful unsupported state |
| Settings migration breaks existing users | High | Serde defaults and v2rayN default client |
| Subscription and profile concepts are conflated | High | Separate subscription abstraction and explicit unsupported capabilities |

## Related Work

- Task 0011 - subscription-mode profile switch validation matrix.
- Task 0013 - adapter architecture and initial Happ integration.
- Decision 0013 - multi-client adapter architecture.
