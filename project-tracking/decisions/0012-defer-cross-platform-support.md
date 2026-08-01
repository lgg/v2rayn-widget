# 0012 - Defer Cross-Platform Support

## Decision

Linux and macOS support is deferred. The current product and both implemented adapters rely on Windows process discovery, Windows UI Automation, Windows privilege/UIPI behavior, Windows window management and Windows packaging. No validated non-Windows client/control path has been selected.

## Rationale

A cross-platform shell without a reliable target-client status/control contract would create misleading partial support. The frontend adapter boundary is reusable, but that is not evidence that the current runtime works outside Windows.

## Conditions to reopen

- identify a maintained target client for Linux/macOS;
- document stable status and control contracts;
- validate on real target systems;
- define platform-specific capability states and packaging;
- add dedicated CI and manual QA evidence.

## Current product impact

None. Windows remains the only supported platform. No Linux/macOS capability is advertised.
