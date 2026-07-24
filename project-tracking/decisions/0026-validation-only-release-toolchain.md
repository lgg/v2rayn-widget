# 0026 - Validation-only Windows Release Toolchain

## Status

Accepted.

## Decision

The dedicated Windows runner is a validation and build executor, not a provisioning host.

Repository workflows and installer scripts must use only tools that were provisioned manually before the runner starts. Missing, incomplete or mismatched tools fail the build without downloading, repairing, updating, elevating or launching a dependency installer.

## Pinned policy

`scripts/ci-toolchain-policy.json` is the source of truth for:

- the minimum Node.js version;
- the exact locked Tauri CLI version;
- the Rust target host;
- the Tauri NSIS version;
- the exact NSIS required-file list;
- the expected `nsis_tauri_utils.dll` SHA-1.

The policy must match `package-lock.json` and the behavior of the pinned Tauri bundler.

## NSIS cache

On Windows, the pinned Tauri bundler uses `%LOCALAPPDATA%\tauri\NSIS`; it does not select an arbitrary `makensis.exe` from PATH.

Before packaging, validation must confirm:

- every Tauri-required NSIS file exists in that exact cache;
- the utility plugin hash matches the pinned value;
- the cached compiler reports the expected version;
- a deterministic fingerprint can be generated for the complete cache.

Release and local installer builds compare fingerprints before and after bundling. A changed fingerprint fails the build.

## Installer behavior

The installer configuration explicitly sets:

- NSIS `installMode` to `currentUser` so installation does not require Administrator access;
- WebView2 `webviewInstallMode` to `skip` so the installer never downloads or executes a WebView2 setup program.

The application therefore requires WebView2 to be present on the target Windows system.

## Persistent-runner security

- Every checkout sets `persist-credentials: false`.
- Official Actions are pinned to full commit SHAs.
- npm cache locations remain process-scoped and are removed after artifact upload.
- Concrete Rust toolchain binaries precede rustup proxies on PATH.
- Visual Studio environment initialization and required compiler tools are validated before checks.

## Enforcement

`scripts/test-workflow-contracts.mjs` validates workflows, helper scripts, the toolchain policy, the npm lockfile and installer configuration. Changes that weaken these guarantees must fail before project dependencies or build commands execute.
