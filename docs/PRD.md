# PRD: v2rayN Mini-Dashboard (MVP)

## Problem

v2rayN users in TUN mode need quick status visibility and control without opening a large main window.

## Product goal

A compact Windows utility widget that provides:
- always-available status,
- fast toggle for **Enable TUN**,
- minimal tray workflow,
- localized UI (EN/RU),
- user-configurable behavior in Settings.

## Users

- Windows users who run v2rayN daily.
- Users who need a small always-visible control panel.

## MVP scope

- Tauri app for Windows 10/11 x64.
- Floating compact widget + tray integration.
- Status fields:
  - overall status,
  - TUN state,
  - active profile,
  - external IP,
  - latency,
  - last error/event (backend),
  - live clock in UI.
- Actions:
  - toggle,
  - refresh,
  - open v2rayN,
  - copy IP.
- Experimental profile switching from selector.
- Settings include:
  - language,
  - theme,
  - always-on-top,
  - autostart with Windows,
  - poll interval (numeric),
  - time format,
  - show/hide profile selector,
  - show/hide action buttons,
  - show/hide external IP and latency,
  - latency mode,
  - endpoint lists,
  - v2rayN path mode + manual path,
  - path detect/validate/reset,
  - transparency effect + opacity.

## Important implementation notes

- Toggle is implemented for **Enable TUN** path.
- Primary method: UI automation.
- Fallback method: config-based toggle of `EnableTun` and restart when needed.

## Out of MVP

- v2rayN fork / IPC API integration.
- Full profile editor.
- Installer / auto-updater.
- Full cross-platform parity.

## Future scope

- Optional diagnostics page that opens a configured external leak-test site in a separate app WebView.
- Installer and packaging pipeline.
- Better subscription-aware profile switching robustness.
- Linux/macOS widget port after platform control-path validation.
