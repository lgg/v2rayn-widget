# 0018 - Full Project and Screen Audit

## Metadata

| Field | Value |
| --- | --- |
| Status | Final Verification |
| Priority | P1 |
| Type | full-project audit / hardening |
| Created | 2026-07-22 |
| Baseline | `50e7f6b3590910417741fc43500e37f4a7924bf2` |
| Labels | audit, frontend, rust, windows, tauri, accessibility, release |

## Scope

- audit every tracked source, configuration, workflow, script and documentation file;
- trace every Rust command, service, adapter, state transition and external-file/process operation;
- audit every frontend entry point, screen, component, user action, loading/error/empty state and cross-window synchronization path;
- verify keyboard access, focus behavior, labels, destructive-action safety, overflow and small-window layouts;
- verify v2rayN and Happ detection, status, control, diagnostics and failure-closed behavior;
- verify settings persistence, migrations, concurrency, stale-result rejection and event delivery;
- verify dependency, security, release, portable and NSIS pipelines;
- add regression coverage for every reproducible defect;
- remove all temporary audit tooling before merge;
- squash-merge only after the permanent final gate is green on the exact final head.

## Acceptance Criteria

- [x] Complete repository inventory reviewed.
- [x] Every frontend window and meaningful state reviewed.
- [x] Every backend command and externally visible operation traced.
- [x] Confirmed defects fixed with regression coverage where deterministic.
- [ ] Frontend audit, tests and production build pass on the final head.
- [ ] Rust formatting, tests, strict Clippy and locked check pass on the final head.
- [ ] Portable executable and NSIS installer are produced and verified from the final head.
- [x] Temporary tooling is absent from the final diff.
- [x] Documentation and audit report match the verified implementation.
- [ ] PR is squash-merged into `main`.

## Final verification remediation

- Canonical endpoint expectations and release-only warning cleanup are being verified after the first full packaging run exposed two stale test assertions.

## Report

- `project-tracking/reports/0018-full-project-screen-audit-report.md`
