# 0010 - Add Optional External Diagnostics WebView Report

## Summary

Historical diagnostics feature closed after adding an optional external diagnostics WebView with settings and validation.

## Done

- Added diagnostics enable/disable setting.
- Added configurable HTTP(S) diagnostics site URL.
- Added dashboard diagnostics action gated by the setting.
- Added separate app WebView for diagnostics.
- Avoided built-in DNS/WebRTC/IP leak diagnostics.
- Added validation for diagnostics URL.

## Changed Areas

| Area | Status | Notes |
| --- | --- | --- |
| Rust/Tauri backend | Done | Diagnostics window command and validation affected |
| React/TypeScript frontend | Done | Settings and dashboard action affected |
| Shared types/API contracts | Done | Settings/command API affected |
| Tests | Done | Historical close reason references validation |
| Documentation | Done | README/architecture mention diagnostics behavior |
| Build/release scripts | Not applicable | No release flow change known |
| Config/examples | Done | Default diagnostics settings included |
| Project tracking | Done | Markdown task/report added |

## Changed Files

- `README.md`
- `docs/architecture.md`
- `src/frontend/src/app/App.tsx`
- `src/frontend/src/app/SettingsWindow.tsx`
- `src/frontend/src/lib/types.ts`
- `src/tauri/src/commands/mod.rs`
- `src/tauri/src/models/settings.rs`
- `src/tauri/src/utils/settings_store.rs`

## Verification

| Check | Result | Notes |
| --- | --- | --- |
| Tests/manual QA | Passed historically | Close reason: implemented optional external diagnostics WebView with settings and validation |
| Docs review | Passed historically | Diagnostics appears in README and architecture docs |
| Public redaction review | Passed | No private diagnostics URL included |

## Not Verified

- Tests were not rerun during Markdown migration.
- External diagnostics site behavior is outside project control.

## Residual Risks

- Custom diagnostics URLs must remain validated to avoid local/private network targeting.

## Next Steps

- Keep diagnostics URL validation aligned with endpoint safety rules.
