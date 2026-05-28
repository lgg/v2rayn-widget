# Tasks

## Phase 1: Data & status reliability

- [x] Parse `guiNConfig.json` for TUN and active profile id.
- [x] Add DB fallback parser for profiles (`guiNDB.db` / `ProfileItem`).
- [x] Resolve active profile name via `IndexId` mapping.

Exit criteria:
- active profile is correctly resolved when JSON profile arrays are empty.

## Phase 2: Window UX and rendering

- [x] Remove external scroll/overflow artifacts in widget.
- [x] Repair settings panel scroll/layout for lower blocks.
- [x] Add draggable behavior for non-interactive regions (including settings overlay).
- [x] Add window effect toggle + opacity setting.

Exit criteria:
- compact window remains usable and visually stable in both dashboard and settings modes.

## Phase 3: Settings expansion

- [x] Add autostart with Windows.
- [x] Add show/hide action buttons.
- [x] Add show/hide profile selector.
- [x] Add compact layout behavior when profile selector is hidden.

Exit criteria:
- all new options persist and apply correctly.

## Phase 4: Interaction quality

- [x] Move action buttons under info panel.
- [x] Remove duplicated profile from info block.
- [x] Replace raw error line with styled transient notice.
- [x] Make info-panel clock update every second.
- [x] Reduce UI flicker during background refresh.

Exit criteria:
- no distracting pulse on poll refresh, clear in-style error feedback.

## Phase 5: Toggle and profile controls

- [x] Improve toggle reliability for Enable TUN (automation + fallback).
- [x] Keep profile switching marked experimental with safe fallback.

Exit criteria:
- toggle returns stable result on target machine or meaningful actionable error.

## ToDo / backlog

1. Subscription-mode profile switch validation matrix.
2. Linux/macOS widget port feasibility and control-path parity.

## Completed release workflow tasks

- [x] Installer packaging flow: `scripts/build-installer.ps1` builds a Windows NSIS installer through the project-local Tauri CLI.
- [x] Optional diagnostics page: settings can enable a dashboard action that opens the configured external leak-test site in a separate app WebView.
