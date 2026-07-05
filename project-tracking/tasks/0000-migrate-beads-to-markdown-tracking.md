# 0000 - Migrate Beads to Markdown Tracking

## Metadata

| Field | Value |
| --- | --- |
| Status | Closed |
| Priority | P1 |
| Type | task |
| Source | User request |
| Public redaction | Completed |

## Context

The project had task state split between Beads and `docs/tasks.md`. The requested workflow requires adapting `lgg/chatgpt-coding-projects-bootstrap` task/report rules to this repository and moving the current task tracker state into Markdown files.

## Goal

Make `project-tracking/` the public, repo-native source of truth for roadmap, tasks, reports, decisions, checklists and templates.

## Scope

Included:

- Add adapted `AGENTS.md`.
- Add `project-tracking/` structure.
- Add task/report/decision templates.
- Add Definition of Done checklist.
- Add roadmap.
- Migrate all Beads issues into Markdown task files.
- Add reports for closed Beads issues using available tracker metadata.
- Add explicit public redaction rules.

Out of scope:

- Changing application behavior.
- Reopening or modifying historical Beads records.
- Publishing private local/runtime data.

## Affected Areas

- Rust/Tauri backend: Not affected.
- React/TypeScript frontend: Not affected.
- Shared types/API contracts: Not affected.
- Tests: Not affected.
- Documentation: Updated.
- Build/release scripts: Not affected.
- Config/examples: Not affected.
- Project tracking: Updated.
- Other: README and legacy `docs/tasks.md` references.

## Acceptance Criteria

- [x] Bootstrap task/report rules are adapted to this repo.
- [x] Public-project redaction rules are explicit.
- [x] All Beads issues are represented as Markdown task files.
- [x] Closed Beads issues have Markdown reports with historical close reason.
- [x] Open Beads issues remain visible as open work.
- [x] README points contributors and agents to `AGENTS.md` and `project-tracking/`.
- [x] Public task/report materials do not contain secrets, private URLs, local system paths or personal data.

## Verification Plan

- [x] Lint/static checks: Markdown structure inspected with file listing/search.
- [ ] Tests: Not applicable, documentation-only migration.
- [ ] Build: Not applicable, documentation-only migration.
- [x] Manual QA: Compare migrated task count with Beads `bd list --all`.
- [x] Build/release config review: Not affected.
- [x] Documentation review: README, AGENTS and project-tracking files checked for consistency.
- [x] Public redaction review: No private runtime values included.

## Questions and Answers

| Question | Status | Answer / Decision |
| --- | --- | --- |
| Should Docker/Coolify rules from bootstrap be copied verbatim? | Resolved | No. They are adapted as not applicable to this desktop project; build/release script rules are used instead. |
| Should Beads remain source of truth? | Resolved | No. Markdown in `project-tracking/` is now source of truth. |

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Historical reports lack full original verification output | Medium | Reports explicitly state that checks were not rerun during migration and preserve Beads close reason. |
| Future work updates Beads but not Markdown | Medium | `AGENTS.md` states Markdown is the source of truth. |

## Links

- Roadmap: `project-tracking/roadmap/0000-roadmap.md`
- Related decisions: `project-tracking/decisions/0000-project-working-rules.md`
- Related reports: `project-tracking/reports/0000-migrate-beads-to-markdown-tracking-report.md`
- Source tracker: Beads snapshot from `bd list --all --long --json`
