# 0006 - Add UI/E2E Smoke Tests for Dashboard and Settings Flows

## Metadata

| Field | Value |
| --- | --- |
| Status | Closed |
| Priority | P2 |
| Type | task |
| Source | Beads `v2rayn-1w8` |
| Created | 2026-05-28T07:23:59Z |
| Closed | 2026-05-28T07:42:47Z |
| Labels | audit, next, testing |
| Public redaction | Completed |

## Context

Frontend coverage was mostly i18n parity. Main dashboard/settings behaviors needed smoke coverage.

## Goal

Add automated smoke coverage for core dashboard and settings flows.

## Scope

Included:

- Refresh state behavior.
- Copy IP notices.
- Settings save behavior.
- Profile selector behavior.
- Tauri command integration boundaries where practical.

Out of scope:

- Full native desktop E2E coverage for every Windows integration.
- Testing real private v2rayN configs or subscription data.

## Affected Areas

- Rust/Tauri backend: Command boundaries may be mocked.
- React/TypeScript frontend: Dashboard/settings components and store.
- Shared types/API contracts: Test fixtures may cover command contracts.
- Tests: UI smoke tests.
- Documentation: Task/report tracking.
- Build/release scripts: Standard validation path, if updated.
- Config/examples: Not affected.
- Project tracking: Updated.

## Acceptance Criteria

- [x] Automated tests cover main dashboard/settings behaviors.
- [x] Tests run in the standard validation path.
- [x] Public task/report materials do not contain secrets, private URLs, local system paths or personal data.

## Verification Plan

- [x] Tests: Historical implementation verified in working tree.
- [x] Public redaction review: Completed during migration.

## Questions and Answers

| Question | Status | Answer / Decision |
| --- | --- | --- |
| Should real v2rayN data be used in tests? | Resolved | No. Use safe mocks/fixtures only. |

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Tests become brittle around Tauri integration boundaries | Medium | Mock native boundaries where practical. |

## Links

- Related reports: `project-tracking/reports/0006-add-ui-e2e-smoke-tests-for-dashboard-and-settings-flows-report.md`
- Source tracker: Beads `v2rayn-1w8`
