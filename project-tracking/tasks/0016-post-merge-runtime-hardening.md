# 0016 - Post-Merge Runtime Hardening

## Metadata

| Field | Value |
| --- | --- |
| Status | In Progress |
| Priority | P1 |
| Type | post-merge audit / runtime hardening |
| Created | 2026-07-22 |
| Labels | audit, v2rayn, config, processes, privileges, tauri, tests |

## Context

PR #3 was squash-merged into `main` as `4ed1b9a42ea164d4b1201131d76e94752ad4591d`. This task audits that exact merged tree independently and focuses on runtime failure modes not fully exercised by build-only verification.

## Scope

- external v2rayN config ownership and recovery behavior;
- process selection and restart correctness with multiple installations;
- privilege diagnostics scoped to the selected v2rayN instance;
- application launch working directory;
- regression tests, full Release Quality workflow and public redaction.

## Acceptance Criteria

- [ ] Status reads never overwrite an existing external v2rayN config.
- [ ] Mutations fail closed when the primary external config is corrupt.
- [ ] Restarts report success only after a matched process actually terminates.
- [ ] v2rayN launches with its installation directory as the working directory.
- [ ] UIPI checks use the process belonging to the selected installation.
- [ ] Focused regression tests cover confirmed defects where deterministic testing is possible.
- [ ] Frontend and full Windows Release Quality workflow pass on the final head.
- [ ] A separate PR is squash-merged into `main`.
