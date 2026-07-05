# 0011 - Build Subscription-Mode Profile Switch Validation Matrix

## Metadata

| Field | Value |
| --- | --- |
| Status | Open |
| Priority | P2 |
| Type | task |
| Source | Beads `v2rayn-760` |
| Created | 2026-05-28T07:24:02Z |
| Labels | qa, roadmap |
| Public redaction | Required before commit/update |

## Context

Profile switching is experimental and must be validated across subscription-driven v2rayN setups before the project can claim broader reliability.

## Goal

Create a validation matrix documenting supported and unsupported profile-switching cases for subscription-driven v2rayN setups.

## Scope

Included:

- Define setup variants to test without exposing private subscription data.
- Record expected behavior.
- Record observed behavior.
- Record failure modes.
- Create follow-up fixes for unsupported or unreliable cases.

Out of scope:

- Publishing real subscription URLs, private profile names, proxy endpoints, logs or configs.
- Implementing all follow-up fixes in this task.
- Cross-platform validation.

## Affected Areas

- Rust/Tauri backend: Profile reading/switching commands may be inspected.
- React/TypeScript frontend: Profile selector behavior may be verified.
- Shared types/API contracts: Profile/status models may be referenced.
- Tests: QA matrix and possible smoke/regression tests.
- Documentation: Validation matrix and tracking updates.
- Build/release scripts: Not expected.
- Config/examples: Not expected.
- Project tracking: Must be updated with results and follow-up tasks.

## Acceptance Criteria

- [ ] A validation matrix exists with tested setup variants.
- [ ] Matrix documents expected behavior, observed behavior and failure modes.
- [ ] Matrix documents supported and unsupported cases.
- [ ] Follow-up fixes are created for actionable failures.
- [ ] No real subscription URLs, proxy endpoints, private profile names, logs, local paths or configs are committed.
- [ ] Public task/report materials do not contain secrets, private URLs, local system paths or personal data.

## Verification Plan

- [ ] Manual QA: Test representative subscription-driven v2rayN setups.
- [ ] Tests: Add regression coverage for any code-level fixes that come out of the matrix.
- [ ] Documentation review: Ensure matrix is understandable without private data.
- [ ] Public redaction review: Confirm all private runtime values are redacted.

## Questions and Answers

| Question | Status | Answer / Decision |
| --- | --- | --- |
| Which subscription setup variants are available for validation? | Open | Need safe, redacted variant list before testing. |
| Where should the matrix live? | Proposed | Add `project-tracking/reports/0011-build-subscription-mode-profile-switch-validation-matrix-report.md` when validation is done, and add a dedicated docs file if the matrix becomes long. |

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Real subscription data leaks into docs | High | Use placeholders and run redaction review before commit. |
| Results depend on specific v2rayN version | Medium | Record version category without private paths/configs. |
| UI automation differs by privilege context | Medium | Record admin/non-admin context generically and keep README warning current. |

## Links

- Roadmap: `project-tracking/roadmap/0000-roadmap.md`
- Source tracker: Beads `v2rayn-760`
