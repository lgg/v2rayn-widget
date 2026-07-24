# 0025 - Disable CI System Installation and UAC-capable Provisioning

## Status

In progress.

## Context

The dedicated interactive Windows runner displayed UAC prompts while the repository quality workflow was running. The workflow explicitly requested Rust toolchain/component installation and also built the NSIS installer on every PR revision. A persistent CI runner must never provision or update system toolchains during a repository job.

## Requirements

- CI must not execute `rustup toolchain install`, `rustup component add`, `actions/setup-node`, package-manager system installers, `msiexec`, elevation commands or setup executables.
- Rust, Node.js, npm, MSVC, rustfmt, Clippy and NSIS must be provisioned manually before the runner service starts.
- Missing prerequisites must fail immediately with a clear message and no installation attempt.
- npm dependencies may be restored only into the repository workspace with lifecycle scripts disabled.
- PR quality must not build NSIS or run any generated installer.
- Release packaging may invoke only an already-existing `makensis.exe` and must never run the produced setup executable.
- Workflow contract tests must enforce the no-provisioning policy.

## Acceptance criteria

- [x] Automatic Rust installation is rejected inside GitHub Actions.
- [x] Quality and release workflows contain no setup/toolchain installation actions.
- [x] Rust component installation commands are removed.
- [x] Node.js and Rust/MSVC are validated as pre-provisioned prerequisites.
- [x] NSIS is checked before release packaging and is never installed by the workflow.
- [x] npm uses `ci --ignore-scripts` and process-scoped cache/registry settings.
- [x] NSIS smoke packaging is removed from the PR quality gate.
- [ ] Final quality run passes without UAC or provisioning commands.
- [ ] PR is merged into `main`.
