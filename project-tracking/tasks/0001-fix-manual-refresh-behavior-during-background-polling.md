# 0001 - Fix Manual Refresh Behavior During Background Polling

## Metadata

| Field | Value |
| --- | --- |
| Status | Closed |
| Priority | P1 |
| Type | bug |
| Source | Beads `v2rayn-pfk` |
| Created | 2026-05-28T07:23:55Z |
| Closed | 2026-05-28T07:42:47Z |
| Labels | audit, next |
| Public redaction | Completed |

## Context

Manual refresh returned immediately when a background refresh was already in flight. That made the refresh action invisible to the user and could leave loading state unclear.

## Goal

Make manual refresh during background polling produce a visible, safe refresh attempt.

## Scope

Included:

- Handle manual refresh while background polling is in progress.
- Prevent stale loading state.
- Keep refresh behavior understandable for the user.

Out of scope:

- Reworking the whole polling architecture.
- Adding unrelated dashboard UI changes.

## Affected Areas

- Rust/Tauri backend: Status refresh command behavior, if needed.
- React/TypeScript frontend: Dashboard refresh state.
- Shared types/API contracts: Only if command return behavior changes.
- Tests: Dashboard/store refresh behavior.
- Documentation: Task/report tracking.
- Build/release scripts: Not affected.
- Config/examples: Not affected.
- Project tracking: Updated.

## Acceptance Criteria

- [x] Clicking Refresh during background polling results in a user-visible refresh attempt.
- [x] Refresh behavior does not leave loading state stale.
- [x] Public task/report materials do not contain secrets, private URLs, local system paths or personal data.

## Verification Plan

- [x] Tests: Covered in historical implementation.
- [x] Manual QA: Refresh behavior verified in historical implementation.
- [x] Public redaction review: Completed during migration.

## Questions and Answers

| Question | Status | Answer / Decision |
| --- | --- | --- |
| Should manual refresh queue or supersede background refresh? | Resolved | Use the safe behavior implemented in the historical fix; exact implementation is captured in source history. |

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Polling and manual refresh can race | Medium | Keep loading state transitions covered by tests. |

## Links

- Related reports: `project-tracking/reports/0001-fix-manual-refresh-behavior-during-background-polling-report.md`
- Source tracker: Beads `v2rayn-pfk`
