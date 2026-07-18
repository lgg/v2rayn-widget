# v2rayN Widget (Multi-Client Adapter Preview)

Portable Windows utility app with a compact always-visible proxy/VPN dashboard.

The project started as a v2rayN TUN widget. It is now being refactored around explicit client adapters so the same UI can work with v2rayN, Happ and future desktop clients without duplicating the application.

## Contributor and agent workflow

Before making changes, read `AGENTS.md`.

Project planning, tasks, reports, decisions and checklists live in `project-tracking/`. The project is public: do not put tokens, private URLs, subscription links, local system paths, real client configs/logs or personal data into tasks, reports or docs.

The active multi-client roadmap is documented in:

- `project-tracking/roadmap/0013-proxy-client-adapter-roadmap.md`
- `project-tracking/tasks/0013-add-proxy-client-adapters-and-happ-mvp.md`
- `project-tracking/decisions/0013-multi-client-adapter-architecture.md`

## UI Preview

![Widget Full](docs/screenshots/widget-full.png)

![Widget Compact](docs/screenshots/widget-compact.png)

Existing screenshots show the original v2rayN-focused UI. Updated multi-client screenshots should be captured after Windows validation.

## Current adapter status

| Client | Detection/status | Open app | Connect/disconnect | Profile/server selection | Subscriptions |
| --- | --- | --- | --- | --- | --- |
| v2rayN | Supported | Supported | Supported for Enable TUN | Experimental | Unsupported |
| Happ | Read-only MVP | Supported when executable is detected | Research required | Research required | Research required |

### v2rayN adapter

The current v2rayN implementation is preserved behind the adapter boundary:

- installation/path detection;
- process monitoring;
- config and log reading;
- combined connection-state resolution;
- external IP and latency checks;
- Enable TUN control through Windows UI Automation;
- config toggle plus reload/restart fallback;
- profile list reading;
- experimental active profile switching;
- open/restart and privilege diagnostics.

Explicit limitations:

- subscription listing is not supported;
- subscription switching is not supported;
- subscription refresh/update is not supported;
- adding or removing subscriptions is not supported;
- profile switching in subscription-driven setups remains experimental and must not be described as subscription switching;
- generic Proxy/TUN/Mixed transport-mode reporting is not implemented.

### Happ adapter

The first Happ adapter is intentionally conservative:

- detects known Happ desktop process names;
- obtains the executable path from a running process when possible;
- checks common Windows installation locations;
- can open the detected application;
- reports generic external IP and latency diagnostics;
- reports `Unknown` while Happ is running because a reliable internal connection-state source has not yet been validated;
- never treats process existence alone as proof that the VPN is connected.

Not implemented yet:

- official or validated daemon IPC integration;
- reliable connect/disconnect;
- Proxy/TUN/Mixed mode detection;
- server/profile list and selection;
- subscription operations;
- manual Happ path editor in the settings UI.

## Important warning: permissions and user context

For v2rayN control, run the widget under the same user account and privilege level as v2rayN.

If v2rayN is started as Administrator, start the widget as Administrator too. Mixed privilege context can break UI Automation for toggle/profile actions.

The current Happ adapter does not perform UI Automation or mutate Happ configuration.

## Architecture summary

The application has three primary layers:

- frontend (`src/frontend`) - shared widget UI, selected-client UX, capability-gated controls, localization and polling;
- application layer (`src/tauri/src/client_commands.rs`) - generic Tauri command dispatch and persisted selection;
- adapters (`src/tauri/src/adapters`) - client descriptors, capabilities and client-specific implementation.

`ProxyClientAdapter` is the common registration boundary. The first registered adapters are `v2rayN` and `Happ`.

Legacy v2rayN Tauri commands remain available during the staged migration so existing debug and control flows are not removed in one high-risk change.

## Stack

- Rust backend + Tauri desktop runtime
- React + TypeScript + Vite frontend
- Tailwind CSS
- Zustand state store
- i18next JSON localization

## Shared widget capabilities

- Rounded floating widget with light/dark themes
- Tray icon menu and close-to-tray
- Selectable client application
- Startup, manual and periodic status refresh
- Capability-gated connection and profile/server controls
- External IP and latency display controls
- EN/RU localization
- Always-on-top and autostart settings
- Mockup mode for screenshots/streams
- Optional external diagnostics page
- Window transparency effect and opacity control

## Project layout

```text
project-root/
  README.md
  AGENTS.md
  docs/
    architecture.md
    PRD.md
    research-notes.md
    ui-reference.md
  project-tracking/
    roadmap/
    tasks/
    reports/
    decisions/
    checklists/
    templates/
  scripts/
    rust-env.ps1
    test-rust.ps1
    build-portable.ps1
    build-installer.ps1
  src/
    frontend/
    tauri/
      src/
        adapters/
          mod.rs
          v2rayn.rs
          happ.rs
        client_commands.rs
        commands/
        models/
        services/
```

## Development

### Frontend

```bash
cd src/frontend
npm install
npm run dev
```

### Tauri

```bash
cd src/tauri
cargo tauri dev
```

## Quality checks

```bash
cd src/frontend
npm test
npm run build
```

```powershell
./scripts/rust-env.ps1 -Bootstrap
./scripts/test-rust.ps1
```

The repository also contains a Windows CI workflow for frontend tests/build and Rust formatting/tests/checks.

## Build portable executable

```powershell
./scripts/build-portable.ps1
```

Output: `dist/portable/v2rayn-widget.exe` or a timestamped file if the target executable is locked.

## Build Windows installer

```powershell
./scripts/build-installer.ps1
```

Output: `src/tauri/target/release/bundle/nsis/*.exe`.

Portable remains the primary artifact until installer behavior and the multi-client migration are validated on target Windows machines.

## v2rayN folder expectations

A configured v2rayN folder must contain:

- `v2rayN.exe`
- `guiConfigs/`
- `guiLogs/`

The adapter currently reads:

- `guiConfigs/guiNConfig.json`
- `guiConfigs/guiNDB.db`
- the latest file in `guiLogs/`

## Logging

Widget logs are written to the application config directory under:

- `v2rayn-widget/logs/widget.log`

## Next work

- validate this adapter refactor on Windows with the existing v2rayN workflow;
- validate Happ process detection and application launch against installed versions;
- research an official CLI/API or stable daemon IPC before adding Happ control;
- finish the v2rayN subscription-driven profile-switch validation matrix;
- introduce subscriptions as a separate model only after safe client-specific operations exist;
- consider repository/product renaming after multi-client behavior is stable.
