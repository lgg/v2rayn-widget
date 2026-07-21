# 0014 - Post-Merge Deep Audit and Hardening

## Metadata

| Field | Value |
| --- | --- |
| Status | In progress |
| Priority | P1 |
| Type | audit / hardening |
| Created | 2026-07-21 |
| Labels | audit, adapters, happ, v2rayn, tauri, frontend, ci |
| Public redaction | Pending |

## Context

PR #1 introduced the operational proxy-client adapter architecture and experimental Happ UI Automation, then was squash-merged into `main`. This task independently audits the exact merged tree rather than relying only on the original PR review and pre-merge workflow.

## Goal

Verify that the merged implementation is internally consistent, safe, buildable and accurately documented; fix every reproducible defect found; merge the resulting hardening changes back into `main` through a separate pull request.

## Scope

- exact merged-tree review against the acceptance criteria of task 0013;
- frontend/backend command and type contract consistency;
- stale-operation, settings concurrency and migration behavior;
- Happ UI Automation fail-closed behavior and diagnostics redaction;
- v2rayN backward compatibility and unsupported subscription claims;
- Tauri capabilities, window configuration and runtime error handling;
- Windows CI, portable build path and release-script consistency;
- documentation, project tracking and public redaction review;
- additional regression tests for every fixed defect.

## Out of Scope

- implementing Happ subscriptions or server switching;
- claiming a stable Happ API/CLI without verified evidence;
- removing legacy v2rayN commands;
- unrelated UI redesign or product renaming.

## Acceptance Criteria

- [ ] Exact squash-merged `main` tree is audited, not only the feature branch.
- [ ] Every changed command has matching frontend API/types and Tauri registration.
- [ ] Settings writes cannot lose fields across windows or stale operations.
- [ ] Happ control remains opt-in and fails closed on ambiguity or failed confirmation.
- [ ] Diagnostics cannot expose arbitrary user/profile/subscription text.
- [ ] v2rayN behavior and explicit subscription limitations remain accurate.
- [ ] Frontend tests and production build pass.
- [ ] Rust formatting, tests, strict Clippy and `cargo check --locked` pass.
- [ ] Portable build or the closest available release build path is validated in Windows CI.
- [ ] Documentation and report reflect verified behavior and residual runtime risks.
- [ ] Public redaction review passes.
- [ ] Hardening PR is merged into `main` and post-merge status is checked.

## Verification Plan

1. Inspect the exact merge commit and all files changed by PR #1.
2. Run automated frontend and Rust quality gates.
3. Add a Windows release-smoke job that exercises the portable build path without publishing artifacts permanently.
4. Add focused tests for every newly identified edge case.
5. Review generated diagnostics and tracked documentation for private data.
6. Merge only after the final PR head is green and review threads are clear.

## Risks

- Happ UI structure is version-sensitive and cannot be fully proven without the installed target version.
- Windows UI Automation may behave differently across privilege levels and user sessions.
- A successful compile does not replace a real interactive Windows smoke test; remaining runtime limitations must be explicit.

## Links

- Previous task: `project-tracking/tasks/0013-add-proxy-client-adapters-and-happ-mvp.md`
- Previous report: `project-tracking/reports/0013-add-proxy-client-adapters-and-happ-mvp-report.md`
- Previous PR: `#1`
