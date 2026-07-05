# 0004 - Implement or Remove Window Fix Mode Behavior

## Metadata

| Field | Value |
| --- | --- |
| Status | Closed |
| Priority | P2 |
| Type | bug |
| Source | Beads `v2rayn-0mh` |
| Created | 2026-05-28T07:23:57Z |
| Closed | 2026-05-28T07:42:47Z |
| Labels | audit, next, ux |
| Public redaction | Completed |

## Context

`window_fix_mode` was persisted but `window_visuals` did not apply different behavior for the available modes. Exposing an inert setting creates UX confusion.

## Goal

Either implement observable window fix modes or remove the unused setting from UI/model/docs.

## Scope

Included:

- Resolve mismatch between persisted setting and actual window behavior.
- Update UI/model/docs/tests as needed.

Out of scope:

- Broad redesign of window rendering.
- Unrelated visual refresh.

## Affected Areas

- Rust/Tauri backend: Window visuals.
- React/TypeScript frontend: Settings UI/model.
- Shared types/API contracts: Settings model.
- Tests: Settings/window behavior.
- Documentation: Architecture/tasks/reports.
- Build/release scripts: Not affected.
- Config/examples: Not affected.
- Project tracking: Updated.

## Acceptance Criteria

- [x] Changing window fix mode has observable behavior covered by code/tests, or the unused setting is removed from UI/model/docs.
- [x] Public task/report materials do not contain secrets, private URLs, local system paths or personal data.

## Verification Plan

- [x] Tests/manual QA: Historical implementation verified in working tree.
- [x] Public redaction review: Completed during migration.

## Questions and Answers

| Question | Status | Answer / Decision |
| --- | --- | --- |
| Implement modes or remove setting? | Resolved | Historical implementation resolved the mismatch; see git history for exact approach. |

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Window visuals differ across Windows compositor/GPU setups | Medium | Keep behavior covered by manual visual checks where automation is insufficient. |

## Links

- Related reports: `project-tracking/reports/0004-implement-or-remove-window-fix-mode-behavior-report.md`
- Source tracker: Beads `v2rayn-0mh`
