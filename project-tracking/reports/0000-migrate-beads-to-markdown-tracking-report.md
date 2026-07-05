# 0000 - Migrate Beads to Markdown Tracking Report

## Summary

Adapted bootstrap task/report rules for this public Tauri/React/Rust desktop project and migrated the current Beads tracker state into Markdown files.

## Done

- Added `AGENTS.md` with project-specific workflow rules.
- Added `project-tracking/` structure.
- Added templates for tasks, reports and decisions.
- Added Definition of Done checklist.
- Added project roadmap.
- Migrated all 12 Beads issues into Markdown task files.
- Added reports for 10 closed Beads issues.
- Added explicit public redaction policy for tasks, reports, decisions and roadmap.
- Updated legacy docs entry points to point to the new tracker.

## Changed Areas

| Area | Status | Notes |
| --- | --- | --- |
| Rust/Tauri backend | Not applicable | Documentation-only migration |
| React/TypeScript frontend | Not applicable | Documentation-only migration |
| Shared types/API contracts | Not applicable | No API changes |
| Tests | Not applicable | No executable behavior changed |
| Documentation | Done | README, AGENTS, docs/tasks and project-tracking updated |
| Build/release scripts | Not applicable | No script changes |
| Config/examples | Not applicable | No config changes |
| Project tracking | Done | Markdown tracker is now source of truth |

## Changed Files

- `AGENTS.md`
- `README.md`
- `docs/tasks.md`
- `project-tracking/README.md`
- `project-tracking/roadmap/0000-roadmap.md`
- `project-tracking/checklists/0000-definition-of-done.md`
- `project-tracking/decisions/0000-project-working-rules.md`
- `project-tracking/templates/task-template.md`
- `project-tracking/templates/report-template.md`
- `project-tracking/templates/decision-template.md`
- `project-tracking/tasks/*.md`
- `project-tracking/reports/*.md`

## Verification

| Check | Result | Notes |
| --- | --- | --- |
| Lint/static checks | Not run | Markdown-only migration; no project markdown linter configured |
| Tests | Not run | No code behavior changed |
| Build | Not run | No code behavior changed |
| Manual QA | Passed | Migrated task count matches Beads: 12 historical issues plus migration task |
| Docs review | Passed | README, AGENTS, roadmap and legacy tasks page point to Markdown tracker |
| Build/release config review | Passed | Build/release scripts not changed |
| Public redaction review | Passed | No private URLs, tokens, local system paths, private configs or personal data included |

## Not Verified

- Historical closed-task implementation checks were not rerun during migration.

## Questions Resolved

| Question | Resolution |
| --- | --- |
| How to handle Docker/Coolify bootstrap rules? | Replaced with desktop build/release rules relevant to this project. |
| How to handle Beads after migration? | Markdown files are the source of truth; Beads is only historical source data. |

## Open Questions

| Question | Owner | Next Step |
| --- | --- | --- |
| Should Beads files be removed later? | User | Decide after confirming the Markdown workflow is enough. |

## Residual Risks

- If future work updates Beads but not `project-tracking/`, tracker state can diverge.

## Next Steps

- Use `project-tracking/tasks/0011-build-subscription-mode-profile-switch-validation-matrix.md` for the next QA planning work.
- Use `project-tracking/tasks/0012-assess-linux-and-macos-feasibility-after-platform-control-path-validation.md` before any cross-platform implementation.
