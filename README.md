# Proxy Client Widget

Portable Windows utility with a compact always-visible dashboard for desktop proxy/VPN clients.

The project started as a v2rayN TUN widget. It now uses explicit operational adapters so the same frontend and Tauri command layer can work with v2rayN, Happ and future clients.

## Adapter status

| Client | Detection/status | Open app | Connect/disconnect | Profile/server selection | Subscriptions |
| --- | --- | --- | --- | --- | --- |
| v2rayN | Supported | Supported | Supported for Enable TUN | Experimental | Unsupported |
| Happ | Supported baseline; UI status experimental | Supported | Experimental opt-in UI Automation | Research required | Research required |

### v2rayN

Preserved behind the compatibility adapter:

- installation/path detection;
- process, config and log signals;
- combined status resolution;
- external IP and latency checks;
- Enable TUN through Windows UI Automation;
- config toggle plus reload/restart fallback;
- profile list;
- experimental active profile switching;
- open/restart and privilege diagnostics;
- process, privilege and UI control scoped to the configured installation;
- serialized refresh/control operations and stale-context rejection;
- primary-only action confirmation with explicit desired-state fallback;
- non-mutating status reads and fail-closed, schema-preserving config updates;
- existing-process activation without duplicate launch.

Explicit limitations:

- subscription listing is not supported;
- subscription switching is not supported;
- subscription refresh/update is not supported;
- adding/removing subscriptions is not supported;
- profile selection is not subscription switching;
- generic Proxy/TUN/Mixed reporting is not implemented for v2rayN.

### Happ

Safe baseline:

- detects known processes and PID;
- detects or validates the executable path;
- checks common Windows installation locations;
- opens Happ;
- reports generic IP/latency diagnostics;
- never infers Connected from process existence alone;
- provides a dedicated Happ Setup and diagnostics window;
- scopes runtime operations to the configured executable and serializes refresh/control/setup actions;
- activates an exact running installation instead of launching a duplicate.

Experimental connection control:

- disabled by default;
- requires explicit consent in Happ Setup;
- scopes window discovery to the detected Happ PID;
- accepts only a high-confidence Connect/Disconnect action;
- rejects Auto connect, Reconnect and settings labels;
- supports English and Russian action labels;
- fails without clicking when the UI is ambiguous;
- can report an exact selected Proxy/TUN/Mixed label when the current UI exposes one.

The adapter does not modify Happ config, database or subscription files.

Still unavailable for Happ:

- stable official CLI/API/daemon IPC;
- server/profile list or selection;
- restart/reload;
- subscriptions.

## Using Happ

1. Select **Happ** in the widget.
2. Open the adapter setup with the sliders button beside the selector.
3. Detect the executable automatically or enter a path to `Happ.exe`.
4. Run the Happ probe.
5. Review the detected process, window, action and confidence score.
6. Enable experimental Windows UI Automation only after the probe identifies the current installed UI correctly.

The connect button remains disabled until experimental control is explicitly enabled.

## Architecture

Four responsibility layers:

- frontend (`src/frontend`) — shared UI, selected-client UX, setup/debug windows, capability gating, i18n and polling;
- generic commands (`src/tauri/src/client_commands.rs`) — resolve the selected adapter and invoke its contract;
- adapters (`src/tauri/src/adapters`) — client-specific operations and capability descriptors;
- services (`src/tauri/src/services`, `src/tauri/src/utils`) — health checks, persistence, window behavior and automation helpers.

`ProxyClientAdapter` owns:

- descriptor/capabilities;
- refresh;
- toggle;
- list/select items;
- open;
- diagnostics.

`client_commands.rs` has no v2rayN/Happ operation branching. Future adapters are registered in the adapter module and implement the same contract.

Legacy v2rayN commands remain registered during staged migration so existing debug/control workflows are not removed in this refactor.

Network diagnostics reject non-public literal and DNS-resolved targets, disable redirects and ambient proxy settings, and pin hostname requests to the exact public socket addresses that were validated before the request. Settings normalization bounds endpoint lists, polling and opacity values before persistence.

All four local windows expose explicit loading/error behavior. Settings and Happ Setup route native close requests through unsaved-draft confirmation, and asynchronous Tauri listeners are disposed safely even when registration finishes after a React surface unmounts.

## Contributor workflow

Read `AGENTS.md` before changing the project.

Planning and decisions:

- `project-tracking/roadmap/0013-proxy-client-adapter-roadmap.md`
- `project-tracking/tasks/0013-add-proxy-client-adapters-and-happ-mvp.md`
- `project-tracking/decisions/0013-multi-client-adapter-architecture.md`
- `project-tracking/reports/0013-add-proxy-client-adapters-and-happ-mvp-report.md`
- `project-tracking/tasks/0014-post-merge-deep-audit.md`
- `project-tracking/tasks/0015-final-main-tree-audit.md`
- `project-tracking/tasks/0016-post-merge-runtime-hardening.md`
- `project-tracking/reports/0016-post-merge-runtime-hardening-report.md`
- `project-tracking/tasks/0017-final-post-merge-audit.md`
- `project-tracking/reports/0017-final-post-merge-audit-report.md`
- `project-tracking/tasks/0018-full-project-screen-audit.md`
- `project-tracking/reports/0018-full-project-screen-audit-report.md`
- `project-tracking/tasks/0024-self-hosted-runner-and-full-audit.md`
- `project-tracking/decisions/0024-self-hosted-ci-runner.md`
- `project-tracking/reports/0024-self-hosted-runner-and-full-audit-report.md`
- `project-tracking/tasks/0025-disable-ci-system-installation.md`
- `project-tracking/decisions/0025-validation-only-self-hosted-ci.md`
- `project-tracking/reports/0025-disable-ci-system-installation-report.md`

The repository is public. Do not commit credentials, subscription URLs, private endpoints, real local paths, runtime configs/logs or personal data.

## Stack

- Rust + Tauri
- React + TypeScript + Vite
- Tailwind CSS
- Zustand
- i18next

## Development

Frontend:

```bash
cd src/frontend
npm install
npm run dev
```

Tauri:

```bash
cd src/tauri
cargo tauri dev
```

## Quality checks

```bash
cd src/frontend
npm ci
npm audit --audit-level=high
npm test
npm run build
```

```powershell
./scripts/rust-env.ps1 -Bootstrap
./scripts/test-rust.ps1
```

The permanent `Release Quality` workflow runs both jobs on the dedicated Windows self-hosted runner selected by `[self-hosted, v2rayn-widget-ci]`. It validates every non-draft same-repository PR revision on `opened`, `reopened`, `ready_for_review` and `synchronize`; PR-number concurrency cancels obsolete runs.

CI is validation-only. Node.js, npm, the stable x64 MSVC Rust toolchain, rustfmt, Clippy and Visual Studio C++ Build Tools must already exist on the runner. Workflow jobs never install or update system toolchains, request elevation, invoke package-manager installers or run generated setup executables. Missing prerequisites fail immediately with a manual-provisioning message.

Frontend dependencies are restored only into the checkout with `npm ci --ignore-scripts`, process-scoped registry/cache settings and cleanup after artifact upload. The PR quality gate does not package NSIS installers.

The Release Quality workflow additionally:

- verifies workflow runner, trigger, no-provisioning, permission and cleanup contracts;
- rejects high-severity frontend dependency advisories;
- transfers the exact built frontend into the Tauri job;
- checks formatting for the complete Rust workspace;
- runs the Rust regression suite;
- runs strict `cargo clippy --locked --all-targets -- -D warnings`;
- runs strict release/no-default-features Clippy;
- executes `cargo check --locked`;
- performs a locked release build and verifies that the portable Windows executable is produced.

The trusted `Build Release Assets` workflow also uses `v2rayn-widget-ci`, but only with pre-provisioned Node/Rust/MSVC/NSIS tools. The generated installer is packaged and uploaded; it is never executed by CI. The only write-enabled release-publishing job remains on an isolated hosted Linux runner, does not check out project code, and uploads only checksum-verified allowlisted assets. See `docs/release-process.md`.

## Build portable executable

```powershell
./scripts/build-portable.ps1
```

Output: `dist/portable/v2rayn-widget.exe` or a timestamped file when the target executable is locked.

## Build Windows installer

```powershell
./scripts/build-installer.ps1
```

Output: `src/tauri/target/release/bundle/nsis/*.exe`.

## v2rayN folder expectations

A configured v2rayN folder must contain:

- `v2rayN.exe`
- `guiConfigs/`
- `guiLogs/`

The adapter reads:

- `guiConfigs/guiNConfig.json`
- `guiConfigs/guiNDB.db`
- the latest file in `guiLogs/`

## Permissions

For v2rayN control, run the widget under the same Windows account and privilege level as v2rayN. Mixed privilege levels can block UI Automation.

Happ UI Automation is also affected by Windows privilege isolation. The setup probe fails safely when the current window cannot be inspected.

## Logging

Widget logs are written to the application config directory under:

- `v2rayn-widget/logs/widget.log`

## Future independent work

- separate subscription abstraction and client-specific implementation;
- additional adapters using the existing operational contract;
- eventual compatibility-field and legacy-command cleanup;
- product/repository naming cleanup after release validation.
