# 0003 - Restart Only the Intended v2rayN Process

## Metadata

| Field | Value |
| --- | --- |
| Status | Closed |
| Priority | P1 |
| Type | bug |
| Source | Beads `v2rayn-je9` |
| Created | 2026-05-28T07:23:57Z |
| Closed | 2026-05-28T07:42:47Z |
| Labels | audit, next |
| Public redaction | Completed |

## Context

Restart fallback terminated every process named v2rayN. This could stop unrelated instances and surprise users.

## Goal

Target only the v2rayN process associated with the configured or detected application base path.

## Scope

Included:

- Match restart target to configured/detected v2rayN path.
- Leave unrelated v2rayN instances running.
- Preserve meaningful errors when the target cannot be identified.

Out of scope:

- General process manager redesign.
- Cross-platform process control.

## Affected Areas

- Rust/Tauri backend: Process monitor/restart fallback.
- React/TypeScript frontend: Error display if restart fails.
- Shared types/API contracts: Not expected.
- Tests: Process selection behavior, where practical.
- Documentation: Task/report tracking.
- Build/release scripts: Not affected.
- Config/examples: Not affected.
- Project tracking: Updated.

## Acceptance Criteria

- [x] Restart fallback terminates only the matching process.
- [x] Unrelated v2rayN instances are left alone.
- [x] Public task/report materials do not contain secrets, private URLs, local system paths or personal data.

## Verification Plan

- [x] Tests/manual QA: Historical implementation verified in working tree.
- [x] Public redaction review: Completed during migration.

## Questions and Answers

| Question | Status | Answer / Decision |
| --- | --- | --- |
| Should process matching use configured or detected path? | Resolved | Use configured or detected v2rayN base path. |

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Process path cannot be read under some privilege contexts | Medium | Return actionable errors and document same-user/admin requirement. |

## Links

- Related reports: `project-tracking/reports/0003-restart-only-the-intended-v2rayn-process-report.md`
- Source tracker: Beads `v2rayn-je9`
