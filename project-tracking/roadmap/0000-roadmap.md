# 0000 - Roadmap

## Purpose

Этот файл фиксирует верхнеуровневый roadmap Windows desktop-виджета. Проект начался как `v2rayN Widget`, но теперь развивается в сторону единого интерфейса с адаптерами v2rayN, Happ и будущих proxy/VPN client applications.

Подробный multi-client roadmap: `project-tracking/roadmap/0013-proxy-client-adapter-roadmap.md`.

## Status Legend

| Status | Meaning |
| --- | --- |
| Planned | Запланировано, еще не начато |
| In Progress | В работе |
| Blocked | Есть блокер или открытый вопрос |
| Done | Сделано и проверено |
| Deferred | Осознанно отложено |

## Phase 0 - Project Tracking Migration

Status: Done

Goals:

- Адаптировать bootstrap-правила под Tauri/React/Rust desktop-проект.
- Создать `AGENTS.md`.
- Создать `project-tracking/`.
- Перенести актуальное состояние Beads в Markdown.
- Добавить публичный redaction policy.

Acceptance criteria:

- Новый участник или агент понимает процесс работы.
- README явно ссылается на `AGENTS.md`.
- Есть task/report/decision/checklist/templates.
- Beads-задачи представлены в Markdown.

## Phase 1 - MVP Reliability

Status: Done

Goals:

- Стабилизировать чтение v2rayN config/profile data.
- Улучшить status refresh и background polling.
- Ограничить custom network check endpoints безопасными публичными HTTP(S) targets.
- Перезапускать только intended v2rayN process.

Related tasks:

- `0001-fix-manual-refresh-behavior-during-background-polling`
- `0002-restrict-network-check-endpoints-to-safe-public-http-targets`
- `0003-restart-only-the-intended-v2rayn-process`

## Phase 2 - Widget UX and Settings

Status: Done

Goals:

- Устранить проблемы widget/settings layout.
- Добавить/проверить controls visibility, unsaved settings warning, window visual behavior.
- Сохранить compact utility UX.

Related tasks:

- `0004-implement-or-remove-window-fix-mode-behavior`
- `0005-warn-before-losing-unsaved-settings-draft`
- `0006-add-ui-e2e-smoke-tests-for-dashboard-and-settings-flows`

## Phase 3 - Packaging and Documentation

Status: Done

Goals:

- Добавить installer packaging flow.
- Обновить architecture docs и command API list.
- Зафиксировать текущие fixes/docs в git history.

Related tasks:

- `0007-update-architecture-docs-with-current-command-api`
- `0008-commit-current-fixes-and-updated-docs-api-list`
- `0009-add-installer-packaging-flow`

## Phase 4 - Diagnostics and Profile Validation

Status: In Progress

Goals:

- Поддерживать optional external diagnostics WebView без built-in leak diagnostics.
- Валидировать profile switching для subscription-driven v2rayN setups.
- Не смешивать profile switching и subscription switching.

Related tasks:

- `0010-add-optional-external-diagnostics-webview` - Done
- `0011-build-subscription-mode-profile-switch-validation-matrix` - Open

Current limitation:

- v2rayN subscription listing, switching, refresh and management are unsupported.

## Phase 5 - Multi-Client Adapter Architecture

Status: In Progress

Goals:

- Ввести настоящий `ProxyClientAdapter` boundary и registry.
- Сохранить текущую v2rayN интеграцию за v2rayN adapter.
- Добавить persisted выбор v2rayN/Happ.
- Перевести основной frontend и tray на generic client commands.
- Показывать действия только по adapter capabilities.
- Добавить безопасный read-only Happ MVP.
- Зафиксировать отдельный roadmap для Happ API/IPC research, control и subscriptions.

Related work:

- `0013-add-proxy-client-adapters-and-happ-mvp` - In Progress
- `project-tracking/roadmap/0013-proxy-client-adapter-roadmap.md`
- `project-tracking/decisions/0013-multi-client-adapter-architecture.md`

Current Happ limitation:

- reliable connection state, connect/disconnect, transport mode, server selection and subscriptions require further API/IPC research.

## Phase 6 - Happ Control Research and Implementation

Status: Planned

Goals:

- Проверить официальный CLI/API.
- Исследовать daemon IPC только в redacted и version-aware формате.
- Выбрать безопасный supported control path.
- Реализовать status/control только после отдельного decision.
- Не определять Connected только по наличию процесса.

## Phase 7 - Subscription Abstraction

Status: Planned

Goals:

- Создать отдельную subscription model, не подменяя ее profiles/servers.
- Добавить capability states для list/switch/refresh/manage.
- Реализовывать операции отдельно для каждого клиента только при безопасном supported path.

Baseline:

- v2rayN subscription capabilities - Unsupported.
- Happ subscription capabilities - Research Required.

## Phase 8 - Cross-Platform Feasibility

Status: Planned

Goals:

- Рассмотреть Linux/macOS только после проверки platform-specific client control paths на реальных системах.
- Зафиксировать feasibility decision перед началом реализации.

Related tasks:

- `0012-assess-linux-and-macos-feasibility-after-platform-control-path-validation` - Open

## Current Open Work

| ID | Task | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| 0011 | Build subscription-mode profile switch validation matrix | P2 | Open | QA matrix; subscriptions themselves remain unsupported |
| 0012 | Assess Linux and macOS feasibility after platform control path validation | P3 | Open | После стабилизации Windows adapters |
| 0013 | Add proxy client adapters and Happ MVP | P1 | In Progress | Trait/registry, generic UI/API, v2rayN compatibility, Happ read-only MVP |

## Public Data Rule

Roadmap entries must not include private URLs, tokens, secrets, local system paths, real client configs, subscription data, addresses or personal data.
