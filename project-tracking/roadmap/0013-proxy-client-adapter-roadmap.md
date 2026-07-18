# 0013 - Proxy Client Adapter Roadmap

## Purpose

Превратить v2rayN-specific widget в расширяемый Windows desktop widget для нескольких proxy/VPN client applications.

Первый набор адаптеров:

- v2rayN — текущая рабочая интеграция без потери существующих сценариев;
- Happ — detection/open/diagnostics и добровольно включаемое экспериментальное connect/disconnect;
- future adapters — возможность добавлять приложения без копирования frontend и общего Tauri dispatcher.

## Product Principles

1. Один общий интерфейс виджета, несколько client adapters.
2. Пользователь явно выбирает целевое приложение.
3. UI показывает только действия, заявленные adapter capabilities.
4. Неподдерживаемые функции не имитируются.
5. Legacy v2rayN commands сохраняются как compatibility API до отдельной задачи удаления.
6. Неофициальный UI Automation path является version-sensitive и требует явного opt-in.
7. Публичный репозиторий не содержит реальных subscription URLs, proxy endpoints, локальных путей и runtime logs.
8. Профили/серверы и подписки являются разными сущностями.

## Capability Model

Capability states:

- `supported` — реализовано и является заявленной частью адаптера;
- `experimental` — реализовано с безопасными ограничениями, но чувствительно к версии клиента;
- `unsupported` — отсутствует;
- `research_required` — безопасный контракт пока не найден.

Shared capabilities:

- detect application;
- read process state;
- read connection state;
- open application;
- connect/disconnect;
- list/select profiles or servers;
- restart application;
- read transport mode;
- list/switch/refresh/manage subscriptions.

## Completed Scope

### Phase A — Operational Adapter Boundary

Status: **Completed**

Implemented:

- `ProxyClientId`, `ClientDescriptor`, `ClientCapabilities`, `TransportMode` and `ClientDiagnostics`;
- migration-safe `selected_client` with v2rayN default;
- compile-time adapter registry;
- operational `ProxyClientAdapter` contract owning descriptor, refresh, toggle, item list/select, open and diagnostics;
- generic `client_commands` dispatcher with no per-client branching;
- compatibility-safe legacy v2rayN commands;
- serialization, registry and capability tests.

### Phase B — v2rayN Compatibility Adapter

Status: **Completed**

Preserved through the generic adapter path:

- path/application detection;
- process/config/log status signals;
- external IP and latency checks;
- Enable TUN UI Automation;
- config mutation plus reload/restart fallback;
- profile list and experimental profile selection;
- open/restart behavior;
- privilege/UIPI diagnostics.

Explicit limitations:

- generic Proxy/TUN/Mixed reporting: unsupported;
- subscription listing: unsupported;
- subscription switching: unsupported;
- subscription refresh/update: unsupported;
- subscription add/remove/manage: unsupported.

Profile switching is not subscription switching.

### Phase C — Client Selection UX

Status: **Completed**

Implemented:

- v2rayN/Happ selector;
- persisted selection;
- immediate state/item reset and refresh after switching;
- selected-client-aware open/refresh/toggle actions;
- capability-gated connection and item controls;
- adapter maturity/status notes;
- separate Happ setup entry next to the selected client.

### Phase D — Happ Detection and Read-Only Baseline

Status: **Completed**

Implemented:

- known process detection with PID;
- executable discovery from a running process;
- common Windows install paths;
- optional validated manual executable path;
- application launch;
- generic network diagnostics;
- conservative `Disconnected` when absent and `Unknown` when no reliable Happ-specific status source exists;
- no config/database/subscription mutation.

### Phase E — Happ Control Research and Decision

Status: **Completed for the current public-contract scope**

Result:

- no documented stable CLI/local API/daemon IPC contract was selected for production control;
- internal database/config mutation was rejected;
- Windows UI Automation was selected only as an explicit experimental fallback;
- the implementation must target the detected Happ PID, require an exact high-confidence Connect/Disconnect action and fail closed on ambiguity;
- UI tree diagnostics are exposed so future Happ UI changes can be investigated without guessing.

### Phase F — Happ Experimental Control MVP

Status: **Completed as experimental**

Implemented:

- persisted `happ_allow_ui_automation`, default `false`;
- separate Happ Setup window with warning and explicit consent;
- process/window diagnostics and redacted UI Automation tree;
- English/Russian Connect/Disconnect recognition;
- rejection of Auto connect, Reconnect and settings labels;
- confidence threshold before any click;
- Invoke, Toggle, LegacyAccessible and native button fallbacks;
- experimental connection-state and exact selected Proxy/TUN/Mixed label reading when available;
- graceful refusal when the window/control cannot be identified;
- connect button stays disabled until opt-in is saved.

Not claimed by this phase:

- stable official Happ API support;
- active server/profile enumeration or selection;
- daemon restart/reload;
- subscription operations.

## Planned Independent Work

### Phase G — Subscription Abstraction

Status: **Planned separately**

Goals:

- model subscriptions independently from profiles/servers;
- support list, active subscription, refresh, switch, add/remove and metadata only where a client exposes a safe contract;
- keep all v2rayN subscription capabilities `unsupported` until implemented and validated;
- keep all Happ subscription capabilities `research_required` until a safe contract exists.

### Phase H — Additional Adapters

Status: **Planned separately**

Onboarding checklist:

- document supported application versions/platforms;
- implement descriptor/capabilities first;
- identify stable status/control sources;
- add detection/read-only status before control;
- use operational adapter methods without modifying `client_commands`;
- add adapter-specific tests, diagnostics and docs;
- avoid client-specific fields in shared frontend contracts unless generalized.

## Testing Strategy and Result

Automated Windows quality pipeline covers:

- frontend unit/component tests;
- TypeScript/Vite production build;
- formatting of changed Rust sources;
- Rust unit/regression tests;
- `cargo check --locked` with the built frontend distribution;
- adapter registry, capability and settings migration tests;
- pure Happ UI action/transport classifier tests;
- existing v2rayN resolver/config/log regression tests.

Runtime validation support:

- v2rayN keeps its existing Debug Tools window;
- Happ provides a dedicated probe with process, PID, executable, window, inferred state, transport, action label, confidence score and UI tree;
- experimental control fails closed if the current installed Happ UI cannot be identified safely.

## Release Strategy

1. Merge the adapter architecture without changing the default client.
2. Keep v2rayN as the migration-safe default.
3. Ship Happ detection/open as safe baseline behavior.
4. Keep Happ UI Automation disabled by default and clearly marked experimental.
5. Use the Happ probe on target machines before enabling control.
6. Implement subscriptions only in a separate reviewed task.
7. Consider repository/product renaming after multi-client behavior is established.

## Open Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Existing frontend assumes TUN/profile semantics | Medium | Compatibility aliases remain; new operations go through generic adapter methods |
| Happ UI changes after an update | High | Explicit opt-in, PID-scoped search, high confidence threshold, probe and fail-closed behavior |
| Process running is mistaken for VPN connected | High | Never infer Connected from process alone |
| Settings migration breaks existing users | High | Serde defaults, v2rayN default and migration tests |
| Subscription and profile concepts are conflated | High | Separate future subscription abstraction and explicit capability states |

## Related Work

- Task 0011 — subscription-mode profile switch validation matrix.
- Task 0013 — adapter architecture and Happ baseline/control MVP.
- Decision 0013 — multi-client adapter architecture.
