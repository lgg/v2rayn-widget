# 0000 - Roadmap

## Purpose

Этот файл фиксирует актуальный roadmap `v2rayN Widget`: компактного Windows desktop-виджета для контроля v2rayN TUN mode.

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

Status: Planned

Goals:

- Поддерживать optional external diagnostics WebView без built-in leak diagnostics.
- Валидировать profile switching для subscription-driven setups.

Related tasks:

- `0010-add-optional-external-diagnostics-webview` - Done
- `0011-build-subscription-mode-profile-switch-validation-matrix` - Open

## Phase 5 - Cross-Platform Feasibility

Status: Planned

Goals:

- Рассмотреть Linux/macOS только после проверки platform-specific v2rayN control paths на реальных системах.
- Зафиксировать feasibility decision перед началом реализации.

Related tasks:

- `0012-assess-linux-and-macos-feasibility-after-platform-control-path-validation` - Open

## Current Open Work

| ID | Task | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| 0011 | Build subscription-mode profile switch validation matrix | P2 | Open | Требуется QA matrix для subscription-driven setups |
| 0012 | Assess Linux and macOS feasibility after platform control path validation | P3 | Open | Решение после реальной проверки control paths |

## Public Data Rule

Roadmap entries must not include private URLs, tokens, secrets, local system paths, real v2rayN configs, subscription data, addresses or personal data.
