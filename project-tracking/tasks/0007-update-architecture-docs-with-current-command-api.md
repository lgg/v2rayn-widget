# 0007 - Update Architecture Docs With Current Command API

## Metadata

| Field | Value |
| --- | --- |
| Status | Closed |
| Priority | P2 |
| Type | task |
| Source | Beads `v2rayn-5dw` |
| Created | 2026-05-28T07:24:00Z |
| Closed | 2026-05-28T07:29:00Z |
| Labels | audit, docs, next |
| Public redaction | Completed |

## Context

`docs/architecture.md` command list was behind current Tauri commands and settings fields.

## Goal

Update architecture documentation to match the current source.

## Scope

Included:

- Tauri command list.
- Settings fields.
- Relevant architecture notes.

Out of scope:

- Implementing new commands.
- Changing product behavior.

## Affected Areas

- Rust/Tauri backend: Source of command list.
- React/TypeScript frontend: Source of settings/API usage.
- Shared types/API contracts: Documentation alignment.
- Tests: Not directly affected.
- Documentation: `docs/architecture.md`.
- Build/release scripts: Not affected.
- Config/examples: Not affected.
- Project tracking: Updated.

## Acceptance Criteria

- [x] Architecture docs list current commands.
- [x] Architecture docs list current settings fields.
- [x] No stale omissions remain in documented command/settings list.
- [x] Public task/report materials do not contain secrets, private URLs, local system paths or personal data.

## Verification Plan

- [x] Documentation review: Historical task completed in commit.
- [x] Public redaction review: Completed during migration.

## Questions and Answers

| Question | Status | Answer / Decision |
| --- | --- | --- |
| Is this implementation or docs-only? | Resolved | Docs-only alignment with current source. |

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Command docs drift again | Medium | `AGENTS.md` requires docs updates when commands/settings change. |

## Links

- Related reports: `project-tracking/reports/0007-update-architecture-docs-with-current-command-api-report.md`
- Source tracker: Beads `v2rayn-5dw`
