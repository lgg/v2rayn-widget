# 0025 - Disable CI System Installation and UAC-capable Provisioning

## Status

Completed; PR #13 prepared for squash merge.

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
- [x] Release Quality run #266 passed without provisioning steps.
- [x] Workflow contracts reject known installer, elevation and toolchain setup commands.
- [x] README, AGENTS, release documentation, decision and report reflect validation-only CI.
- [x] PR #13 contains the complete correction and is ready for squash merge after the exact-head gate.

## Verification evidence

- Release Quality run #266: frontend and Rust/Windows jobs completed successfully on `v2rayn-widget-ci`.
- Pre-provisioned Node.js and Rust/MSVC/rustfmt/Clippy checks passed.
- Frontend audit/tests/build, Rust formatting/tests/Clippy/check and portable release build passed.
- The run contained no NSIS step and no setup/toolchain installation step.

## Related files

- Decision: `project-tracking/decisions/0025-validation-only-self-hosted-ci.md`.
- Report: `project-tracking/reports/0025-disable-ci-system-installation-report.md`.
- Pull request: #13.
