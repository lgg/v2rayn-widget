# 0026 - Post-UAC Fix Hardening Audit Report

## Status

Implementation and installer packaging audit complete; final exact-head quality verification pending.

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

### Persistent NSIS cache was exposed directly to bundling

Correction:

- validate the persistent source cache read-only;
- copy it into a runner-temporary `LOCALAPPDATA` tree;
- require source and isolated fingerprints to match before build;
- require the isolated fingerprint to remain unchanged after build;
- remove the isolated cache in always-running cleanup.

### Installer behavior depended on defaults

Correction:

- explicitly set NSIS to `currentUser` mode;
- explicitly set WebView2 installation to `skip`;
- inspect the generated script for `RequestExecutionLevel user`;
- verify the rendered WebView2 mode, bootstrapper path, offline-installer path and minimum-version definitions are all empty.

The universal Tauri NSIS template still contains compile-time WebView2 branches. Filename presence alone is not treated as an active payload; the rendered definitions determine whether those branches compile.

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
- avoid creating missing global Rust homes in CI;
- validate Clippy behavior through `cargo clippy --version` rather than assuming a specific proxy filename.

### Temporary runner caches remained

Correction:

- frontend and release npm caches are removed during always-running cleanup;
- release fingerprint files and temporary Tauri/NSIS trees are removed as well.

### Release output selection was ambiguous

Correction:

- require exactly one generated `installer.nsi`;
- require exactly one NSIS setup executable;
- require exactly four staged distribution files;
- retain publisher-side allowlist and checksum verification.

### Contract coverage and diagnostics were incomplete

Correction:

- contracts now validate workflows, prerequisite and Rust scripts, local installer build, installer JSON, centralized policy and npm lockfile;
- system installers, elevation, download helpers, setup actions, implicit NSIS packaging in PR quality and global npm mutation remain forbidden;
- contract stdout/stderr is uploaded even when a contract fails;
- the one-off packaging audit preserved full Tauri output, generated installer script and release tree for review.

## Verification

Audit Release Packaging run #10 (`30069117962`) completed successfully on the dedicated `v2rayn-widget-ci` runner at SHA `7e1efaf97a343300e702f4d0bb8ee2516a7afb0a`.

The run successfully:

- validated pre-provisioned Node.js, Rust/MSVC and the exact source NSIS cache;
- restored locked frontend dependencies with lifecycle scripts disabled;
- passed npm audit, frontend tests and frontend build;
- validated the locked Tauri CLI;
- copied the NSIS toolset to isolated runner-temporary storage;
- confirmed source/copy fingerprints matched;
- completed a full locked Tauri NSIS build with Cargo network access disabled;
- confirmed the isolated cache fingerprint did not change;
- verified current-user execution and disabled rendered WebView2 installation definitions;
- produced exactly one installer and uploaded the audited installer plus generated script;
- uploaded diagnostics and cleaned all generated workspace/cache files.

The generated setup executable was never launched.

A final exact-head `Release Quality` run is still required after removal of the one-off audit workflow and final documentation changes.

## Residual boundaries

- The runner toolchain and exact Tauri NSIS cache must be provisioned manually before jobs run.
- WebView2 must already exist on the target Windows system because the installer deliberately skips dependency installation.
- Windows binaries remain unsigned until a code-signing certificate or signing service is configured.
- The repository cannot identify which executable displayed the historical UAC dialog; it can only remove and enforce against repository-controlled provisioning and elevation paths.
