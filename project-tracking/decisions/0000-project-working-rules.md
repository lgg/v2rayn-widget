# 0000 - Project Working Rules

## Status

Accepted

## Context

Проект начинался с Beads и `docs/tasks.md`, но для публичного репозитория нужна переносимая Markdown-структура задач, отчетов, решений и чеклистов. В качестве базы используются правила из `lgg/chatgpt-coding-projects-bootstrap`, адаптированные под Tauri/React/Rust desktop-приложение.

## Decision

В проекте должны быть:

- `AGENTS.md` как главный файл правил для агента;
- `README.md` со ссылкой на `AGENTS.md`;
- `project-tracking/` для roadmap, задач, отчетов, решений, чеклистов и шаблонов;
- нумерация файлов через `0000-`, `0001-`, `0002-`;
- Definition of Done, требующий проверки и обновления связанных мест;
- публичный redaction review перед фиксацией task/report/decision материалов.

Beads больше не является основным источником истины для задач. Актуальное состояние задач хранится в `project-tracking/`.

Bootstrap-правила адаптированы под специфику проекта:

- Git/GitHub правила сохранены, но учитывают локальное требование проекта использовать `lgg <lgg@users.noreply.github.com>` для коммитов.
- Docker/Coolify правила не включены как обязательные, потому что проект является Windows desktop-приложением на Tauri, а не Docker-deployed сервисом.
- Вместо backend/deploy/migrations акцент Definition of Done перенесен на Rust/Tauri backend, React/TypeScript frontend, command API, build/release scripts, portable build и installer flow.
- Security rules расширены публичным redaction policy для v2rayN configs, subscription data, logs, local paths and runtime artifacts.

## Alternatives Considered

| Option | Pros | Cons | Reason Not Chosen |
| --- | --- | --- | --- |
| Оставить только Beads | Удобно для CLI-трекера | Состояние хуже видно в публичном GitHub без Beads tooling | Не соответствует запрошенному Markdown workflow |
| Оставить только `docs/tasks.md` | Просто | Не хранит отчеты, решения, DoD и детальные acceptance criteria | Недостаточно для bootstrap-правил |
| Перенести в `project-tracking/` | Прозрачно в Git, совместимо с bootstrap-правилами | Нужно поддерживать больше файлов | Выбрано |

## Consequences

Positive:

- Новый агент быстрее понимает процесс.
- История задач и отчетов видна без отдельного task tracker.
- Меньше риска забыть docs/tests/build updates.
- Публичный redaction review становится обязательным.

Negative / tradeoffs:

- Нужно поддерживать Markdown-трекер в актуальном состоянии.
- Старый Beads state может устареть, если продолжать вести его параллельно.

## Implementation Notes

- Исторические Beads-задачи перенесены в `project-tracking/tasks/`.
- Для закрытых Beads-задач добавлены `project-tracking/reports/` с доступным close reason.
- Старый `docs/tasks.md` оставлен как указатель на новый источник истины.
- Bootstrap Docker/Coolify requirements documented as not applicable unless a future Docker/Coolify part is explicitly added.

## Public Data Review

- [x] Нет секретов, токенов, приватных URL, локальных системных путей, персональных данных и приватных v2rayN конфигов.

## Review Date

Пересмотреть, если проект вернется к внешнему task tracker как основному источнику истины или появится другой обязательный процесс управления задачами.

## Links

- Related tasks: `project-tracking/tasks/0000-migrate-beads-to-markdown-tracking.md`
