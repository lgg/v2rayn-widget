# 0015 - Final Main-Tree Audit and Release Hardening

## Metadata

| Field | Value |
| --- | --- |
| Status | In Progress |
| Priority | P1 |
| Type | audit / hardening |
| Created | 2026-07-21 |
| Labels | audit, adapters, happ, v2rayn, tauri, frontend, security, ci |

## Context

PR #2 was squash-merged into `main` as `2339ba21cf09ac10fd108f4cfe59874c3f521183`. This task independently audits that exact merged tree and does not rely only on the previous branch review.

## Goal

Verify that the current merged implementation is internally consistent, secure, reproducible and accurately documented; fix every reproducible defect found; merge the verified corrections back into `main` through a separate pull request.

## Scope

- merged-tree integrity and post-merge workflow behavior;
- network diagnostic target validation, DNS pinning, timeouts and response handling;
- v2rayN profile/config compatibility and explicit unsupported boundaries;
- Happ process detection, diagnostics privacy and fail-closed UI Automation;
- settings persistence, concurrency and stale frontend operations;
- dependency lockfile, portable and installer build reproducibility;
- Tauri capabilities, release artifact validation and public redaction;
- focused regression tests for every confirmed fix.

## Acceptance Criteria

- [ ] Exact current `main` tree audited as a complete repository.
- [ ] Every reproducible defect found is fixed in this PR.
- [ ] Frontend install, dependency audit, tests and production build pass.
- [ ] Rust formatting, tests, strict Clippy and locked check pass.
- [ ] Locked Windows release build produces the expected executable.
- [ ] PR contains no temporary audit payloads, private endpoints or local paths.
- [ ] Documentation and final report match verified behavior and residual risks.
- [ ] PR is squash-merged into `main` only after the final head is green.
