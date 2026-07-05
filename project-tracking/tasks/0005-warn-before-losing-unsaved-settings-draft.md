# 0005 - Warn Before Losing Unsaved Settings Draft

## Metadata

| Field | Value |
| --- | --- |
| Status | Closed |
| Priority | P2 |
| Type | bug |
| Source | Beads `v2rayn-nmv` |
| Created | 2026-05-28T07:23:58Z |
| Closed | 2026-05-28T08:19:39Z |
| Labels | audit, next, ux |
| Public redaction | Completed |

## Context

`SettingsWindow` tracked unsaved draft state for saved-only fields, but closing the settings window could discard edits without warning.

## Goal

Protect users from silently losing unsaved settings edits.

## Scope

Included:

- Warn, preserve draft, or clearly communicate discard behavior when closing settings with unsaved saved-only fields.
- Add regression coverage.

Out of scope:

- Redesigning the entire settings model.
- Changing unrelated dashboard controls.

## Affected Areas

- Rust/Tauri backend: Possibly affected by settings persistence commands.
- React/TypeScript frontend: Settings window close/save behavior.
- Shared types/API contracts: Settings model if needed.
- Tests: Regression test for unsaved draft handling.
- Documentation: Task/report tracking.
- Build/release scripts: Not affected.
- Config/examples: Not affected.
- Project tracking: Updated.

## Acceptance Criteria

- [x] Closing settings with unsaved saved-only fields warns, preserves draft, or clearly communicates discard behavior.
- [x] Regression test exists.
- [x] Public task/report materials do not contain secrets, private URLs, local system paths or personal data.

## Verification Plan

- [x] Tests: Regression test completed historically.
- [x] Public redaction review: Completed during migration.

## Questions and Answers

| Question | Status | Answer / Decision |
| --- | --- | --- |
| Which behavior was chosen? | Resolved | Historical close reason: implemented unsaved settings draft warning with regression test. |

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Future settings fields may bypass draft warning | Medium | Add tests when adding saved-only fields. |

## Links

- Related reports: `project-tracking/reports/0005-warn-before-losing-unsaved-settings-draft-report.md`
- Source tracker: Beads `v2rayn-nmv`
