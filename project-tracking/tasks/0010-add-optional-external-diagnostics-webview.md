# 0010 - Add Optional External Diagnostics WebView

## Metadata

| Field | Value |
| --- | --- |
| Status | Closed |
| Priority | P2 |
| Type | feature |
| Source | Beads `v2rayn-10s` |
| Created | 2026-05-28T07:24:03Z |
| Closed | 2026-05-28T20:47:53Z |
| Labels | diagnostics, roadmap |
| Public redaction | Completed |

## Context

The widget needed an optional diagnostics entry point without implementing custom built-in DNS/WebRTC/IP leak diagnostics.

## Goal

Add an optional diagnostics page that opens a configured external HTTP(S) leak-test site in a separate app WebView.

## Scope

Included:

- Settings enable/disable for diagnostics.
- Configurable diagnostics HTTP(S) site URL.
- Dashboard action visible only when diagnostics are enabled.
- Separate app WebView for the configured diagnostics site.
- URL validation.

Out of scope:

- Built-in DNS/WebRTC/IP leak checks.
- Storing or publishing private diagnostics URLs.

## Affected Areas

- Rust/Tauri backend: Diagnostics window command and URL validation.
- React/TypeScript frontend: Settings and dashboard action.
- Shared types/API contracts: Settings model and commands.
- Tests: Settings/action validation where practical.
- Documentation: README/architecture/task/report.
- Build/release scripts: Not affected.
- Config/examples: Default diagnostics setting.
- Project tracking: Updated.

## Acceptance Criteria

- [x] Settings include diagnostics enable/disable.
- [x] Settings include configurable HTTP(S) site URL.
- [x] Dashboard shows diagnostics action only when enabled.
- [x] Opening diagnostics loads the configured external site in a separate app WebView.
- [x] No custom built-in leak diagnostics are added.
- [x] Public task/report materials do not contain secrets, private URLs, local system paths or personal data.

## Verification Plan

- [x] Tests/manual QA: Historical close reason says implemented with settings and validation.
- [x] Documentation review: Diagnostics behavior documented.
- [x] Public redaction review: Completed during migration.

## Questions and Answers

| Question | Status | Answer / Decision |
| --- | --- | --- |
| Should built-in leak diagnostics be implemented? | Resolved | No. The app only opens a configured external diagnostics site. |
| Can users configure a custom diagnostics URL? | Resolved | Yes, with HTTP(S) validation. Private values must not be committed to docs/reports. |

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| User enters unsafe/non-public URL | High | Reuse strict URL validation and public-target safety rules. |
| External site changes behavior | Low | Diagnostics page is explicitly external and optional. |

## Links

- Related reports: `project-tracking/reports/0010-add-optional-external-diagnostics-webview-report.md`
- Source tracker: Beads `v2rayn-10s`
