# UI Reference

## Style direction

- compact floating utility card,
- rounded corners,
- soft translucent panel,
- dark/light themes,
- minimal chrome.

## Window layout

Top zone:
- profile selector block (optional, can be hidden),
- settings button.

Center:
- status chip,
- large circular connect/toggle button.

Bottom:
- info panel (connection + optional external IP + optional latency + live clock),
- optional action row (`refresh`, `open`, `copy`) below info panel.

## Settings panel

- full-height overlay panel,
- internal scroll area,
- sticky footer actions,
- all user-configurable options in one place.

Mandatory options:
- language,
- theme,
- always-on-top,
- autostart,
- poll interval,
- time format,
- profile selector visibility,
- action buttons visibility,
- external IP visibility,
- latency visibility and source,
- endpoints,
- v2rayN path controls,
- transparency effect toggle,
- opacity slider,
- about/version/github placeholder.

## UX behavior

- window draggable on non-interactive areas,
- close hides to tray,
- errors shown as styled transient notice (no raw technical line),
- background polling should not visibly pulse main controls.

## Localization

- all user-facing strings via i18n keys,
- locale JSON files under `src/frontend/src/locales`,
- default locales: `en`, `ru`.
