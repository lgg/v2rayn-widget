# 0025 - Validation-only Self-hosted CI

## Status

Accepted.

## Decision

Repository workflows running on `[self-hosted, v2rayn-widget-ci]` may validate, compile and package the project, but may not provision or update machine-level development tools.

The runner must be prepared manually before its service starts with:

- Node.js 22 or newer and npm;
- stable x64 MSVC Rust toolchain;
- rustfmt and Clippy;
- Visual Studio 2022 C++ Build Tools;
- NSIS for trusted release packaging.

## Prohibited workflow behavior

Self-hosted jobs must not contain or indirectly request:

- `actions/setup-node`, `actions/setup-python` or generic Rust setup actions;
- `rustup toolchain install`, `rustup update` or `rustup component add`;
- `winget install`, Chocolatey, Scoop or other system package installation;
- `msiexec`, setup executable execution, PowerShell `RunAs` or elevation requests;
- generated installer execution;
- npm lifecycle scripts during dependency restoration.

Missing tools are configuration errors. The job must stop with a manual-provisioning instruction rather than attempting recovery.

## Allowed dependency restoration

`npm ci --ignore-scripts` is allowed because it restores locked project dependencies inside the checkout. Registry and cache settings remain process-scoped, and generated directories are cleaned afterward.

Cargo may download locked crate source dependencies into the existing user Cargo home during compilation. It may not install or update the Rust compiler, components, MSVC or system utilities.

## Installer policy

The normal PR `Release Quality` workflow does not build NSIS installers.

The trusted `Build Release Assets` workflow may package an installer only after confirming an existing `makensis.exe`. It creates and uploads the setup executable but never launches it.

## Enforcement

`scripts/test-workflow-contracts.mjs` rejects known setup actions, toolchain installation commands, system package installers, elevation commands and NSIS packaging in the PR quality workflow. `scripts/rust-env.ps1` independently rejects `-Bootstrap` whenever `GITHUB_ACTIONS=true`.

## Rationale

The dedicated runner is an interactive Windows workstation. Automated provisioning can display UAC prompts, alter the user's machine, introduce nondeterministic versions and block unattended jobs. Manual one-time provisioning plus fail-fast validation provides a predictable and non-invasive CI boundary.
