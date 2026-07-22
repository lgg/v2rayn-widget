# 0017 - Final Post-Merge Audit

## Metadata

| Field | Value |
| --- | --- |
| Status | Verification |
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

## Confirmed Findings and Corrections

- serialized foreground/background/control operations to prevent overlapping toggles and stale status commits;
- made UI success depend on an observed primary-config transition;
- replaced toggle-on-fallback with explicit desired-state setting;
- removed unverified config-reread-as-reload logic;
- rejected backup recovery, unknown TUN schemas and non-boolean field retyping on mutation;
- retained and terminated every process belonging to the configured installation;
- checked restart privileges before config mutation;
- activated existing installations instead of spawning duplicates;
- restricted TUN/Reload UI candidates to explicit actions;
- required exact, unambiguous profile names;
- added focused regression coverage for all deterministic findings.

## Acceptance Criteria

- [x] Every changed runtime path is reviewed together with all callers.
- [x] No control action can silently target another installation or stale process.
- [x] External config observation and mutation remain fail-closed and ownership-safe.
- [x] Restart/open behavior cannot report false success or create unintended duplicates.
- [x] Window runtime behavior matches the Tauri configuration.
- [x] Focused regression tests cover all confirmed findings.
- [ ] Full Release Quality workflow passes on the final head.
- [ ] Portable and NSIS artifacts are produced and verified.
- [x] Documentation, temporary-tool cleanup and public redaction are complete.
- [ ] PR is squash-merged into `main`.

## Report

- `project-tracking/reports/0017-final-post-merge-audit-report.md`
