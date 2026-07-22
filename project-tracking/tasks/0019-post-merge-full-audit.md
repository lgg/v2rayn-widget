# 0019 - Post-Merge Full Audit

## Metadata

| Field | Value |
| --- | --- |
| Status | In Progress |
| Priority | P1 |
| Type | post-merge full-project audit / release hardening |
| Created | 2026-07-22 |
| Baseline | `6350c6c333e76b1a1763ce5a31a75f73d57c0283` |
| Labels | audit, frontend, rust, windows, tauri, ci, release |

## Scope

- independently re-review the complete repository after the 0018 squash merge;
- re-trace all frontend screens, user actions, shared components and Tauri command contracts;
- re-trace all Rust adapters, services, commands, persistence, process and Windows side effects;
- verify test/build coverage across every materially different Cargo configuration used by release packaging;
- verify the permanent workflow cannot report a green strict-lint stage while release-only code still emits warnings;
- correct every reproducible issue found and add permanent regression or CI coverage;
- merge only after the full permanent gate passes on the exact final head.

## Acceptance Criteria

- [x] New audit branch starts from the exact 0018 merge commit.
- [ ] Complete post-merge source and screen review recorded.
- [ ] Every reproducible finding corrected.
- [ ] Frontend tests, audit and production build pass.
- [ ] Default/all-target Rust formatting, tests, Clippy and locked check pass.
- [ ] Release/no-default-features Rust configuration passes strict Clippy.
- [ ] Portable executable and NSIS installer are produced.
- [ ] PR is squash-merged into `main`.

## Report

- `project-tracking/reports/0019-post-merge-full-audit-report.md`
