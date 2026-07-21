# 0014 - Post-Merge Deep Audit and Hardening

## Metadata

| Field | Value |
| --- | --- |
| Status | Done |
| Priority | P1 |
| Type | audit / hardening |
| Created | 2026-07-21 |
| Completed | 2026-07-21 |
| Labels | audit, adapters, happ, v2rayn, tauri, frontend, ci |
| Public redaction | Passed |

## Context

PR #1 introduced the operational proxy-client adapter architecture and experimental Happ UI Automation, then was squash-merged into `main`. This task independently audited that exact squash-merged tree rather than relying only on the original PR review and pre-merge workflow.

## Goal

Verify that the merged implementation is internally consistent, safe, buildable and accurately documented; fix every reproducible defect found; merge the resulting hardening changes back into `main` through a separate pull request.

## Scope

- exact merged-tree review against the acceptance criteria of task 0013;
- frontend/backend command and type contract consistency;
- stale-operation, settings concurrency and migration behavior;
- Happ UI Automation fail-closed behavior and diagnostics redaction;
- v2rayN backward compatibility and unsupported subscription claims;
- Tauri capabilities, window configuration and runtime error handling;
- dependency, lockfile, Windows release and build-script verification;
- documentation, project tracking and public redaction review;
- focused regression tests for every fixed defect.

## Out of Scope

- implementing Happ subscriptions or server switching;
- claiming a stable Happ API/CLI without verified evidence;
- removing legacy v2rayN commands;
- unrelated UI redesign or product renaming.

## Confirmed Findings and Fixes

- frontend operations could remain visually busy after a same-client Happ operational settings change invalidated an in-flight request;
- successful backend settings persistence could be reported as failed when a follow-up Tauri event emit failed;
- recursive v2rayN selector lookup/write could confuse profile-record IDs with the active selector;
- profile confirmation accepted substring matches instead of exact normalized names;
- a config containing only an active profile name could be changed without inserting the required ID selector;
- diagnostic hostnames could resolve to local/reserved addresses, and redirects were followed without revalidation;
- the frontend dependency graph contained two high-severity advisories;
- regenerated lockfile entries contained non-public resolved registry URLs and were normalized to the public npm registry;
- CI proved compilation but did not prove that a release `.exe` was produced;
- portable/installer scripts used weaker dependency and Cargo reproducibility checks;
- package and HTML metadata still described the old v2rayN-only product.

## Acceptance Criteria

- [x] Exact squash-merged `main` tree was audited, not only the feature branch.
- [x] Every changed command has matching frontend API/types and Tauri registration.
- [x] Settings writes and stale-operation handling preserve the active client context.
- [x] Happ control remains opt-in and fails closed on ambiguity or failed confirmation.
- [x] Diagnostics do not expose arbitrary user/profile/subscription text.
- [x] v2rayN behavior and explicit subscription limitations remain accurate.
- [x] Frontend dependency installation and high-severity audit pass from a public lockfile.
- [x] Frontend tests pass: 6 files, 19 tests.
- [x] TypeScript/Vite production build passes.
- [x] Rust formatting passes.
- [x] Rust unit/regression suite passes: 46 tests.
- [x] Strict Clippy with warnings denied passes.
- [x] `cargo check --locked` passes.
- [x] `cargo build --release --locked` produces `v2rayn-widget.exe` on Windows.
- [x] Documentation and report reflect verified behavior and residual runtime risks.
- [x] Public redaction review passes.
- [x] PR #2 is the hardening merge that completes this task in `main`.

## Verification

The permanent `Release Quality` workflow now separates platform-neutral frontend validation from Windows-specific Rust/Tauri release validation:

1. clean public npm installation;
2. `npm audit --audit-level=high`;
3. frontend tests and production build;
4. Windows rustfmt check;
5. `cargo test --locked`;
6. `cargo clippy --locked --all-targets -- -D warnings`;
7. `cargo check --locked`;
8. `cargo build --release --locked`;
9. existence and artifact upload of `v2rayn-widget.exe`.

## Residual Runtime Risks

- Happ UI structure is version-sensitive and cannot be fully proven without the installed target version.
- Windows UI Automation may behave differently across privilege levels and user sessions.
- Automated release validation does not replace an interactive check against every Happ or v2rayN installation; experimental controls therefore remain opt-in and fail closed.

## Links

- Previous task: `project-tracking/tasks/0013-add-proxy-client-adapters-and-happ-mvp.md`
- Previous report: `project-tracking/reports/0013-add-proxy-client-adapters-and-happ-mvp-report.md`
- Previous PR: `#1`
- Hardening PR: `#2`
