# 0025 Disable CI System Installation Report

## Incident

After the dedicated Windows runner was enabled, repository jobs displayed UAC prompts on the interactive workstation.

The repository cannot observe the Windows consent dialog itself, but the workflow contained several provisioning-capable operations that should never have been present on this runner:

- `scripts/rust-env.ps1 -UseGlobalHomes -Bootstrap`, which could execute `rustup toolchain install stable`;
- `rustup component add rustfmt clippy --toolchain stable`;
- `actions/setup-node`, which manages a tool installation/cache independently of the runner's provisioned environment;
- an NSIS/Tauri installer build on every PR revision, allowing bundler tooling to be downloaded or prepared during routine quality checks.

## Corrections

### Validation-only prerequisites

Added `scripts/assert-ci-prerequisites.ps1` to check already-installed:

- Node.js and npm;
- stable x64 MSVC Rust, cargo and rustc;
- rustfmt and Clippy;
- Visual Studio x64 C++ tools;
- NSIS tooling for trusted release packaging.

Missing prerequisites stop the job with a manual-provisioning message. The script contains no installer or elevation behavior.

### Rust bootstrap guard

`scripts/rust-env.ps1` now rejects `-Bootstrap` when `GITHUB_ACTIONS=true`. A missing CI toolchain fails closed instead of invoking rustup installation.

Local developer bootstrap remains available outside GitHub Actions.

### PR quality workflow

Removed:

- all `actions/setup-*` steps;
- Rust toolchain/component installation;
- NSIS installer dependency restoration, packaging and artifact upload.

The workflow now:

- verifies pre-provisioned Node and Rust/MSVC tools;
- restores locked npm packages only inside the checkout through `npm ci --ignore-scripts`;
- runs dependency audit, frontend tests/build, Rust formatting/tests/Clippy/check and portable release compilation;
- uploads diagnostics/artifacts and cleans generated directories.

### Trusted release workflow

The release build contains no setup or toolchain installation actions. It verifies pre-provisioned Node/Rust/MSVC/NSIS first. The generated setup executable is staged and uploaded but never launched.

### Contract enforcement

`scripts/test-workflow-contracts.mjs` rejects:

- setup actions;
- Rust installation/update commands;
- `winget`, Chocolatey, Scoop and `msiexec` installation;
- PowerShell elevation via `RunAs`;
- global npm configuration;
- npm dependency restoration without disabled lifecycle scripts;
- NSIS packaging in the PR quality workflow.

It also verifies the independent Rust bootstrap guard.

## Verification

`Release Quality` run #266 executed on `v2rayn-widget-ci` with the new workflow.

Successful steps included:

- pre-provisioned Node.js verification;
- no-provisioning workflow contracts;
- local npm dependency restoration with scripts disabled;
- frontend dependency audit, tests and production build;
- pre-provisioned Rust/MSVC/rustfmt/Clippy verification;
- Rust formatting, tests, both strict Clippy modes and locked check;
- portable release build and artifact upload;
- workspace cleanup.

No NSIS/setup step existed in the run. No workflow step installed or updated Node.js, Rust, Rust components, MSVC or system packages.

## Follow-up correction

The initial implementation treated discovery of an existing `makensis.exe` as sufficient proof that a later Tauri build would not provision tooling. The post-merge audit in task 0026 showed that this was incomplete: the pinned Tauri bundler uses its exact `%LOCALAPPDATA%\tauri\NSIS` cache and may download or repair files when that cache is incomplete or its utility plugin hash differs.

Task 0026 supersedes that part of this report by validating the exact cache, pinned required files and plugin hash, and by comparing a complete cache fingerprint before and after packaging. See:

- `project-tracking/tasks/0026-post-uac-fix-hardening.md`;
- `project-tracking/decisions/0026-validation-only-release-toolchain.md`;
- `project-tracking/reports/0026-post-uac-fix-hardening-report.md`.

## Residual boundary

The repository cannot inspect a Windows UAC dialog or prove which executable displayed a historical prompt. It removes and contractually prohibits every identified repository-controlled provisioning/elevation path. If a prompt occurs after these changes, its executable and publisher should be captured because the source would be outside the checked workflow, such as runner host management or another process on the workstation.
