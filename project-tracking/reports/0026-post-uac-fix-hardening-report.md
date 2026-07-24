# 0026 - Post-UAC Fix Hardening Audit Report

## Status

Implementation complete; final exact-head verification pending.

## Scope

Re-audited the changes merged through PR #13, including:

- persistent Windows runner workflow behavior;
- Node, Rust, MSVC, Tauri CLI and NSIS prerequisite validation;
- release and local installer packaging;
- installer elevation and dependency-install behavior;
- checkout credentials, temporary caches and artifact selection;
- workflow contract coverage and documentation consistency.

## Confirmed findings and corrections

### Exact Tauri NSIS cache was not validated

The previous prerequisite script accepted an arbitrary `makensis.exe`. The pinned Tauri bundler instead uses `%LOCALAPPDATA%\tauri\NSIS` and repairs/downloads its own cache when required files are absent or the Tauri utility plugin hash is wrong.

Correction:

- added a centralized policy matching the pinned Tauri CLI;
- validate the exact cache, every required file, compiler version and plugin SHA-1;
- fingerprint the complete cache before and after packaging;
- removed PATH and recursive compiler discovery.

### Installer behavior depended on defaults

Correction:

- explicitly set NSIS to `currentUser` mode;
- explicitly set WebView2 installation to `skip`;
- the installer no longer requests machine-wide installation or launches a WebView2 dependency setup.

### Persistent checkout retained credentials

Correction:

- every self-hosted checkout now sets `persist-credentials: false`;
- contract tests require this for every checkout.

### Movable Action tags executed on the runner

Correction:

- checkout, artifact upload and artifact download actions are pinned to full commit SHAs;
- contract tests reject unpinned official Actions.

### Rust/MSVC initialization was not fully fail-closed

Correction:

- validate `vswhere` and `VsDevCmd.bat` exit codes;
- reject empty Visual Studio environment output;
- validate `cl.exe`, `link.exe` and `rc.exe`;
- validate the exact Rust target host;
- put concrete toolchain binaries ahead of rustup proxies;
- avoid creating missing global Rust homes in CI.

### Temporary runner caches remained

Correction:

- frontend and release npm caches are removed during always-running cleanup;
- release fingerprint files are removed as well.

### Release output selection was ambiguous

Correction:

- require exactly one NSIS installer;
- require exactly four staged distribution files;
- retain publisher-side allowlist and checksum verification.

### Contract coverage was incomplete

Correction:

- contracts now validate workflows, prerequisite and Rust scripts, local installer build, installer JSON, centralized policy and npm lockfile;
- system installers, elevation, download helpers, setup actions, implicit NSIS packaging in PR quality and global npm mutation remain forbidden.

## Verification

Pending final exact-head Release Quality run on `v2rayn-widget-ci`.

## Residual boundaries

- The runner toolchain and exact Tauri NSIS cache must be provisioned manually before jobs run.
- WebView2 must already exist on the target Windows system because the installer deliberately skips dependency installation.
- Windows binaries remain unsigned until a code-signing certificate or signing service is configured.
