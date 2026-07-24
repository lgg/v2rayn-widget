# 0026 - Post-UAC Fix Hardening Audit

## Status

In progress.

## Context

PR #13 removed explicit CI provisioning after UAC prompts appeared on the dedicated Windows runner. A follow-up audit is required to verify that the validation-only boundary matches the real behavior of the pinned Tauri toolchain and that persistent-runner credentials, caches and compiler setup fail closed.

## Confirmed defects

1. The NSIS preflight accepted any `makensis.exe` found on PATH or recursively below `%LOCALAPPDATA%\tauri`, while the pinned Tauri bundler uses the exact `%LOCALAPPDATA%\tauri\NSIS` cache and can download or replace missing/mis-hashed files.
2. Installer mode and WebView2 dependency behavior relied on defaults rather than explicitly prohibiting elevation and dependency installation.
3. `actions/checkout` persisted the GitHub token in the working repository until its post-step on a persistent runner.
4. npm runner-temp caches were left behind after quality and release jobs.
5. Visual Studio environment initialization did not validate the `VsDevCmd.bat` exit code or imported environment.
6. Rust validation preferred rustup proxy binaries ahead of the concrete pre-provisioned toolchain binaries.
7. Workflow contracts did not inspect the prerequisite script, exact Tauri/NSIS policy, installer configuration, checkout credential handling or action pinning.
8. Official actions were referenced by movable major-version tags rather than immutable commit SHAs.
9. Installer selection used newest-file ordering instead of requiring exactly one output.

## Requirements

- Mirror the exact required-file and plugin-hash checks used by the pinned Tauri CLI.
- Reject incomplete or modified NSIS caches before bundling and verify the cache fingerprint remains unchanged afterward.
- Explicitly use current-user NSIS installation and skip WebView2 installation.
- Pin official GitHub Actions to full commit SHAs.
- Disable checkout credential persistence.
- Validate the locked Tauri CLI, Rust host, MSVC linker and Windows resource compiler.
- Check Visual Studio environment setup failures before running Rust commands.
- Remove generated npm caches and fingerprint files from the persistent runner.
- Enforce every invariant through repository-owned contract tests.
- Keep normal PR quality free from NSIS packaging and generated installer execution.

## Acceptance criteria

- [x] Exact Tauri NSIS cache policy is centralized and validated.
- [x] Arbitrary PATH/recursive `makensis.exe` discovery is removed.
- [x] Installer configuration explicitly avoids elevation and WebView2 installation.
- [x] Checkout credentials are not persisted.
- [x] Official actions are pinned to immutable SHAs.
- [x] Rust/MSVC initialization fails closed.
- [x] Temporary npm caches are cleaned.
- [x] Installer and distribution output counts are deterministic.
- [x] Contract tests cover the new boundary.
- [ ] Full quality run passes on the final exact head SHA.
- [ ] Release packaging path is reviewed and documented.
- [ ] PR is squash-merged into `main`.
