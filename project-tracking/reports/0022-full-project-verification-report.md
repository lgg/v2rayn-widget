# 0022 Full Project Verification Report

## Baseline and coverage

The audit starts from exact `main` commit `62d461f493116d85396210e3d96f69e81aef7128` and rechecks the complete declared product surface rather than only the latest release-workflow diff.

Reviewed areas:

- Main widget, Settings, Debug Tools and Happ Setup windows;
- frontend stores, polling, capability gating, loading/error/empty states, close handling and Tauri listeners;
- generic command dispatch and every registered Tauri handler;
- v2rayN config/log/database/process/UI Automation paths;
- Happ process/path/probe/experimental-control paths;
- settings normalization, atomic persistence, backup recovery and runtime rollback;
- health checks, DNS pinning, public-address filtering and bounded response parsing;
- saved window state and monitor-topology behavior;
- permanent quality workflow, workflow-contract test and release-distribution workflow;
- README/architecture claims against actual implementation.

## Verified implementation

The declared adapter boundary is present and operational. v2rayN and Happ are compile-time registered adapters, generic commands dispatch through the selected adapter, unsupported operations are capability-gated in the frontend and rejected by the backend, and client epochs prevent stale results from being committed after a selection change.

Settings writes are serialized and persisted atomically with backup recovery. Runtime always-on-top and autostart effects roll back when persistence fails. v2rayN external config writes reject invalid primary data, unknown schema invention and concurrent file changes. Process and UI Automation operations are scoped to the selected installation/PID and fail closed when exact control cannot be confirmed.

Network diagnostics disable ambient proxies and redirects, validate all resolved addresses as public, pin hostname requests to the validated socket set, bound external-IP response bodies and accept only public IP literals.

The quality workflow remains limited to deliberate PR lifecycle events and manual dispatch. The independent release workflow builds an exact release tag, separates read-only code execution from write-enabled publication, verifies an exact asset allowlist and checksums, and attaches portable/installer assets to GitHub Releases.

## Confirmed findings and corrections

### Runtime version drift

The Settings About section used a source-code constant `1.0.0`. A later release could update Cargo/Tauri versions and still display the old value.

Correction: read the packaged application version through Tauri `getVersion()` and render a safe fallback when the API is unavailable. Added frontend regression coverage.

### Unknown v2rayN schema reported as disconnected

A running v2rayN process whose config did not expose a boolean `EnableTun` was converted through `unwrap_or(false)` and reported as Disconnected. That was an unsupported inference for a changed or unknown schema.

Correction: preserve the optional config signal. A missing process is still definitely Disconnected; a running process with an unknown TUN field now reports Unknown unless an explicit error signal is available. Added Rust regression coverage.

### Stale network data after disconnect

Partial refresh merging preserved previous external IP and latency even after a client was confirmed Disconnected. The UI therefore displayed old route measurements as if they were current.

Correction: both generic/Happ and v2rayN compatibility merge paths now clear external IP and latency on Disconnected while retaining last values only for partial active/connecting refreshes. Added tests for both behaviors.

### Window can restore outside current monitors

The saved physical position was applied unconditionally. Disconnecting or rearranging monitors could make the main widget inaccessible off-screen.

Correction: enumerate current monitors and restore only when at least an 80×48 physical-pixel drag area remains visible. Otherwise center the widget. The pure geometry contract covers normal, off-screen, tiny-sliver, negative-coordinate and corrupt-size cases.

## Findings not changed

- The external diagnostics webview intentionally supports user-selected HTTP(S) pages. It is excluded from the Tauri capability allowlist, so loaded external content does not receive application command permissions.
- Happ UI Automation remains explicitly experimental and opt-in because its correctness depends on the installed client version, visible desktop session and privilege boundary.
- Windows release binaries remain unsigned because no certificate or secure signing service is configured.

## Final gate

The final head must pass the workflow contract test, frontend dependency audit/tests/build, Rust formatting/tests, default and release strict Clippy, locked check, portable release build and NSIS installer build before merge.
