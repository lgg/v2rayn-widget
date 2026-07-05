# 0003 - Restart Only the Intended v2rayN Process Report

## Summary

Historical Beads task closed after restart fallback was limited to the intended v2rayN process.

## Done

- Updated restart targeting to use the configured or detected v2rayN base path.
- Avoided terminating unrelated v2rayN instances.

## Changed Areas

| Area | Status | Notes |
| --- | --- | --- |
| Rust/Tauri backend | Done | Process monitor/restart behavior affected |
| React/TypeScript frontend | Possibly done | Error display may be affected |
| Shared types/API contracts | Not applicable | No contract change known |
| Tests | Done | Beads close reason says implemented and verified |
| Documentation | Done | Migrated task/report |
| Build/release scripts | Not applicable | No release flow change known |
| Config/examples | Not applicable | No config change known |
| Project tracking | Done | Markdown task/report added |

## Changed Files

- Historical source files are recorded in git history, not in Beads metadata.

## Verification

| Check | Result | Notes |
| --- | --- | --- |
| Tests/manual QA | Passed historically | Beads close reason: implemented and verified in working tree |
| Public redaction review | Passed | No private process paths included |

## Not Verified

- Tests were not rerun during Markdown migration.

## Residual Risks

- Windows privilege boundaries can still prevent process inspection in some user/admin contexts.

## Next Steps

- Keep README warning about matching v2rayN/widget privilege context current.
