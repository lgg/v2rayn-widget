# 0005 - Warn Before Losing Unsaved Settings Draft Report

## Summary

Historical UX bug closed after adding an unsaved settings draft warning and regression test.

## Done

- Added warning behavior before losing unsaved settings draft.
- Added regression coverage.

## Changed Areas

| Area | Status | Notes |
| --- | --- | --- |
| Rust/Tauri backend | Possibly done | Settings persistence may be involved |
| React/TypeScript frontend | Done | `SettingsWindow` close/draft behavior affected |
| Shared types/API contracts | Unknown | Historical migration did not inspect exact diff |
| Tests | Done | Regression test noted in close reason |
| Documentation | Done | Migrated task/report |
| Build/release scripts | Not applicable | No release flow change known |
| Config/examples | Not applicable | No config change known |
| Project tracking | Done | Markdown task/report added |

## Changed Files

- Historical source files are recorded in git history, not in Beads metadata.

## Verification

| Check | Result | Notes |
| --- | --- | --- |
| Tests | Passed historically | Close reason: implemented with regression test |
| Public redaction review | Passed | No private data included |

## Not Verified

- Tests were not rerun during Markdown migration.

## Residual Risks

- New saved-only settings fields need to participate in the same warning behavior.

## Next Steps

- Keep settings close behavior covered when expanding settings.
