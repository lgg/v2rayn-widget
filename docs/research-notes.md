# Research Notes

## Real v2rayN data findings

From real user instance (sample local v2rayN installation):
- `guiNConfig.json` exists and stores `TunModeItem.EnableTun`.
- Active profile id is in root `IndexId`.
- Profile arrays in JSON can be empty.
- Actual profiles are stored in `guiNDB.db` (`ProfileItem` table).

Implication:
- profile parser must support DB fallback,
- active profile resolution should map `IndexId` to `ProfileItem.IndexId`.

## Log behavior

Latest logs can include startup/errors but may not always include reliable latency markers.
Latency may still rely on active checks or last-known fallback.

## Toggle behavior

UI automation by caption can fail across versions/UI trees.
MVP now uses:
1. UI automation attempt,
2. fallback config toggle (`EnableTun`),
3. restart path when required.

## Window rendering notes (Windows + Tauri)

- Transparent undecorated windows can show platform artifacts depending on DWM/driver.
- Mitigation path implemented:
  - disable native shadow,
  - enforce rounded region,
  - layered opacity control,
  - frontend effect toggle + opacity slider.

## Cross-platform note

v2rayN has Linux/macOS builds, but this widget currently remains Windows-first due:
- tray/window behavior assumptions,
- Windows-specific automation and rendering workarounds.

