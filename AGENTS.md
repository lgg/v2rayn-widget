# AGENTS.md

Этот файл обязателен для чтения перед любой работой над проектом. Агент должен соблюдать правила ниже, а при уточнении процесса, архитектуры или требований обновлять этот файл вместе с остальной документацией.

## 1. Базовые правила работы

1. Перед изменениями прочитать:
   - `README.md`;
   - `AGENTS.md`;
   - актуальный роадмап в `project-tracking/roadmap/`;
   - связанные задачи, отчеты и решения в `project-tracking/`.
2. Не начинать реализацию, пока не понятно:
   - что именно надо сделать;
   - какие критерии приемки;
   - какие части системы затрагиваются;
   - как будет проверяться результат.
3. Если вопрос можно разумно решить без пользователя, агент выбирает консервативный вариант, совместимый с текущей архитектурой, и фиксирует решение в отчете.
4. Если вопрос влияет на продуктовую логику, безопасность, данные пользователей, сетевые интеграции, релизные артефакты или необратимые изменения, агент фиксирует вопрос и запрашивает уточнение.
5. Любые изменения должны быть минимально достаточными для задачи. Не делать побочные рефакторы без необходимости.

## 2. Git и коммиты

1. Для git commit использовать:
   - username: `lgg`;
   - email: `lgg@users.noreply.github.com`.
2. Если пользователь просит использовать GitHub App или connector-инструменты, не подменять это консольным `git push`.
3. Для работы с удаленным репозиторием использовать тот способ, который явно попросил пользователь. Если способ не указан, можно использовать обычный git workflow.
4. Коммиты должны быть осмысленными и небольшими настолько, насколько это удобно для ревью.
5. Сообщения коммитов должны объяснять, что изменилось:
   - `0001: add project tracking`;
   - `0002: fix status refresh`;
   - `0003: update installer docs`.
6. Если работа ведется в ветке, название ветки должно быть понятным: `codex/project-tracking`, `feature/profile-validation`, `fix/status-refresh`.
7. Не перезаписывать и не удалять чужие изменения без прямого разрешения пользователя.

## 3. Публичный режим и безопасность данных

Проект публичный. В задачи, отчеты, решения, roadmap, README, комментарии и примеры нельзя добавлять приватные данные.

Запрещено публиковать:

- токены, API keys, приватные ключи, пароли, cookies, session IDs;
- реальные приватные URL, адреса личных сервисов, VPN endpoints, subscription links, webhook URLs;
- локальные абсолютные пути пользователя, имена домашних директорий, сетевые шары, внутренние hostname/IP;
- приватные конфиги v2rayN, subscription payloads, profile IDs, реальные прокси-адреса;
- персональные данные, адреса, телефоны, email кроме публичных noreply/служебных адресов проекта;
- фрагменты логов, если они содержат приватные URL, IP, токены, пути или конфиги.

Как фиксировать такие сведения безопасно:

- использовать плейсхолдеры вроде `<redacted-url>`, `<local-v2rayn-dir>`, `<subscription-profile>`;
- описывать тип данных и поведение без раскрытия значения;
- приводить только публичные, нейтральные примеры;
- перед добавлением task/report делать redaction review.

## 4. Структура проектного трекинга

В проекте используется папка `project-tracking/`:

```text
project-tracking/
  README.md
  roadmap/
  tasks/
  reports/
  decisions/
  checklists/
  templates/
```

Назначение:

- `roadmap/` - долгосрочный план, этапы, зависимости, статус крупных блоков.
- `tasks/` - подробные постановки задач.
- `reports/` - отчеты по выполненным задачам и проверкам.
- `decisions/` - архитектурные, продуктовые и процессные решения.
- `checklists/` - повторяемые чеклисты качества, релиза, безопасности.
- `templates/` - шаблоны задач, отчетов, решений.

Beads больше не является основным источником истины для задач. Актуальное состояние трекера должно быть отражено в `project-tracking/`.

## 5. Нумерация файлов

Для задач, отчетов, решений и крупных дорожных документов использовать префиксы:

- `0000-...`
- `0001-...`
- `0002-...`

Правила:

1. Номер показывает порядок появления работы.
2. Один номер связывает задачу и отчет:
   - `tasks/0003-fix-status-refresh.md`;
   - `reports/0003-fix-status-refresh-report.md`.
3. Не переиспользовать номер для другой темы.
4. Если задача разделилась, создать новые номера и сослаться на исходную задачу.

## 6. Требования к задаче

Каждая задача должна содержать:

- контекст;
- цель;
- что входит в объем;
- что не входит в объем;
- затронутые части проекта;
- критерии приемки;
- план проверки;
- вопросы и ответы;
- риски;
- ссылки на связанные решения, отчеты, PR, файлы.

## 7. Требования к отчету

Каждый отчет должен содержать:

- что было сделано;
- какие файлы и модули изменены;
- какие связанные места обновлены;
- какие проверки выполнены;
- результаты проверок;
- что не удалось проверить и почему;
- остаточные риски;
- следующие шаги.

## 8. Definition of Done

Задача считается завершенной только если выполнены все пункты:

1. Реализация соответствует постановке.
2. Обновлены все связанные места:
   - Rust/Tauri backend;
   - React/TypeScript frontend;
   - shared types/API contracts;
   - tests;
   - documentation;
   - build/release scripts and config;
   - examples/env files, if any;
   - roadmap/tasks/reports.
3. Проверки выполнены локально или через доступный CI.
4. Если проверку выполнить нельзя, причина явно описана в отчете.
5. Нет расхождений вида: backend добавлен, frontend не обновлен; API изменен, типы не обновлены; config изменен, docs устарели.
6. Все новые открытые вопросы записаны в задаче или отдельном decision/task-файле.
7. Выполнен redaction review для публичного репозитория.

## 9. Desktop, Tauri и релизы

1. Portable build остается основным артефактом, пока installer flow не проверен на целевых Windows-машинах.
2. При изменении Tauri commands, settings model или frontend API надо обновить:
   - Rust command handlers;
   - TypeScript types/calls;
   - tests;
   - `docs/architecture.md`;
   - связанные task/report.
3. При изменении релизного процесса надо обновить:
   - `scripts/build-portable.ps1`;
   - `scripts/build-installer.ps1`, если затронут installer;
   - README;
   - roadmap/task/report.
4. Не коммитить реальные пользовательские конфиги v2rayN, логи, subscription data и локальные runtime artifacts.

## 9.1. Docker/Coolify applicability

Правила bootstrap-проекта про Docker Compose и Coolify не копируются как обязательные, потому что этот репозиторий является Windows desktop-приложением на Tauri, а не сервисом с Docker-деплоем.

Если в будущем появится Docker/Coolify-часть, тогда нужно добавить отдельные правила и файлы:

- `docker-compose.yml` для локального запуска;
- `.env.example` только с безопасными примерными значениями;
- `docker-compose.coolify.yml` только для Coolify;
- task/report/decision с описанием, зачем Docker нужен desktop-проекту;
- public redaction review для env, ports, volumes, healthchecks и сетевых endpoints.

## 10. Документация

1. `README.md` должен быть полезен новому разработчику и агенту.
2. В README обязательно должна быть ссылка на `AGENTS.md` с указанием, что его надо читать перед работой.
3. Если меняется поведение продукта, команда запуска, config, API, build/release flow или архитектура, документация обновляется в той же задаче.
4. Документация должна отражать реальное состояние проекта, а не желаемое будущее. Планы фиксируются отдельно в роадмапе.

## 11. Проверки качества

Минимум для каждой задачи:

- статический анализ/lint, если есть;
- тесты, если есть;
- сборка, если есть;
- ручная проверка ключевого сценария, если автоматической проверки недостаточно;
- проверка документации и конфигов;
- redaction review.

Для frontend-задач дополнительно проверять:

- compact/full widget layout;
- settings window layout;
- loading/empty/error states;
- базовую доступность интерактивных элементов;
- отсутствие визуальных регрессий в связанных сценариях.

Для Rust/Tauri-задач дополнительно проверять:

- обратную совместимость command API;
- обработку ошибок и edge cases;
- безопасность чтения конфигов/логов;
- ограничения на внешние URL и локальные цели;
- поведение Windows privileges/user context, если затронуто.

## 11.1. Dedicated GitHub Actions runner

1. Все jobs, которые выполняют, тестируют или собирают код этого репозитория в permanent quality/release workflows, используют:

   ```yaml
   runs-on: [self-hosted, v2rayn-widget-ci]
   ```

2. `Release Quality` обязан проверять каждую актуальную ревизию same-repository PR через `synchronize`, сохраняя PR-number concurrency и `cancel-in-progress: true`.
3. Workflow обязан логировать runner identity и проверять `runner.environment == self-hosted`.
4. Self-hosted CI является validation-only:
   - не устанавливает, не обновляет и не ремонтирует Node.js, Rust, rustfmt, Clippy, MSVC, Windows SDK, Tauri CLI, NSIS или другие системные инструменты;
   - не использует setup actions, `rustup install/update/component add`, `winget`, Chocolatey, Scoop, `msiexec`, `RunAs`, download helpers или запуск setup-файлов;
   - при отсутствии, неполноте или несовпадении инструмента падает с инструкцией по ручной подготовке runner.
5. `scripts/rust-env.ps1 -Bootstrap` запрещен при `GITHUB_ACTIONS=true`, но остается допустимым для ручной локальной подготовки вне CI.
6. npm-зависимости разрешено восстанавливать только внутрь checkout через `npm ci --ignore-scripts`, с process-scoped registry/cache; временный cache удаляется в always-running cleanup.
7. Все official `actions/*` должны быть закреплены полным 40-символьным commit SHA. Major/version tags сами по себе запрещены.
8. Каждый `actions/checkout` на persistent runner использует `persist-credentials: false`.
9. `scripts/ci-toolchain-policy.json` является источником истины для minimum Node.js, exact Tauri CLI, Rust host и exact Tauri NSIS cache contract; он должен совпадать с `package-lock.json` и contract tests.
10. NSIS разрешено брать только из точного `%LOCALAPPDATA%\tauri\NSIS`, который использует закрепленная версия Tauri. PATH lookup и recursive discovery запрещены.
11. Перед trusted installer build проверять exact required-file list, версию NSIS и hash `nsis_tauri_utils.dll`; до и после bundling сравнивать deterministic fingerprint всего cache. Любая мутация cache завершает build ошибкой.
12. Обычный `Release Quality` не собирает NSIS installer и не выполняет setup-файлы. Он только read-only проверяет готовность exact locked Tauri CLI/NSIS cache.
13. Installer config явно использует `currentUser` и `webviewInstallMode: skip`; target Windows обязан уже иметь WebView2.
14. После загрузки нужных artifacts/diagnostics удалять generated `node_modules`, frontend `dist`, Rust `target`, staged release directories, process-scoped npm caches и fingerprint files.
15. Release staging обязан требовать ровно один installer и ровно четыре distribution files; publisher повторно проверяет allowlist и SHA-256.
16. Единственное исключение из self-hosted assignment — изолированный `publish-release` job:
   - остается на hosted Linux;
   - имеет единственное `contents: write` permission;
   - не делает checkout и не выполняет код репозитория;
   - загружает только checksum-verified allowlisted artifacts.
17. Любое изменение workflow, toolchain policy, prerequisite script или installer config должно сопровождаться обновлением `scripts/test-workflow-contracts.mjs`.

## 12. Как обновлять эти правила

Если во время работы появились новые устойчивые правила проекта:

1. Обновить `AGENTS.md`.
2. Добавить или обновить decision-файл в `project-tracking/decisions/`.
3. Упомянуть изменение в отчете по задаче.
4. Проверить, что README не противоречит новым правилам.
