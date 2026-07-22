# 0017 - Final Post-Merge Audit

## Metadata

| Field | Value |
| --- | --- |
| Status | In Progress |
| Priority | P1 |
| Type | independent post-merge audit |
| Created | 2026-07-22 |
| Baseline | `811f6ccf49489ad699f5cd97e0a3454e8fae0eef` |
| Labels | audit, regression, windows, v2rayn, tauri, release |

## Scope

- independently review the exact `main` tree after PR #4;
- verify config ownership, process/PID scoping, UI Automation and restart semantics;
- verify settings/state integration and all command call sites;
- verify startup window behavior and Tauri configuration consistency;
- add regression tests for every reproducible defect;
- run the permanent frontend, Rust, portable and NSIS release gates;
- remove all temporary audit tooling before merge;
- squash-merge the verified PR into `main`.

## Acceptance Criteria

- [ ] Every changed runtime path is reviewed together with all callers.
- [ ] No control action can silently target another installation or stale process.
- [ ] External config observation and mutation remain fail-closed and ownership-safe.
- [ ] Restart/open behavior cannot report false success or create unintended duplicates.
- [ ] Window runtime behavior matches the Tauri configuration.
- [ ] Focused regression tests cover all confirmed findings.
- [ ] Full Release Quality workflow passes on the final head.
- [ ] Portable and NSIS artifacts are produced and verified.
- [ ] Documentation and public redaction are complete.
- [ ] PR is squash-merged into `main`.
