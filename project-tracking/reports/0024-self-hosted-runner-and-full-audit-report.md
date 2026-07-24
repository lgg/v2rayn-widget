# 0024 Self-hosted Runner and Full Project Audit Report

## Baseline and scope

The audit started from `main@5b281bdafd0c15d749ab23726db219b9d0e98dac` after the previous runtime/config-safety audit.

The review covered:

- GitHub Actions triggers, permissions, runner assignment, concurrency, diagnostics and release publication boundaries;
- persistent self-hosted runner state and Windows toolchain setup;
- frontend dependency installation, tests, production build and all application surfaces;
- generic Tauri command dispatch and selected-client stale-operation protection;
- v2rayN and Happ capability declarations and unsupported-operation rejection;
- settings normalization, persistence and backup-preserving replacement;
- v2rayN external config reads/writes, process scoping and fail-closed status behavior;
- Happ process/path scoping and opt-in UI Automation;
- diagnostic URL validation, public-address enforcement, DNS pinning, redirect/proxy controls and response limits;
- Tauri window capabilities, portable/installer scripts and release artifact verification;
- repository documentation, project tracking and public-data hygiene.

## Confirmed finding 1: quality and Windows release jobs ignored the dedicated runner

Both jobs in `Release Quality` used GitHub-hosted runners, and the Windows build in `Build Release Assets` used `windows-latest`. The custom label `v2rayn-widget-ci` was not referenced, so repository tests and packages were not sent to the intended machine.

### Correction

- Both quality jobs now require `[self-hosted, v2rayn-widget-ci]`.
- The Windows release-build job requires the same labels.
- Each self-hosted job logs runner identity, OS and architecture and rejects a non-self-hosted environment.
- The write-enabled release publisher intentionally remains on hosted Linux, does not check out repository code, and accepts only the verified build artifact.

A live PR run was accepted by the label and executed on a Windows X64 self-hosted runner. The actual runner name reported by GitHub was `v2rayn-widget-runner-1213`.

## Confirmed finding 2: later PR revisions were not automatically revalidated

The quality workflow listened for `opened`, `reopened` and `ready_for_review`, but not `synchronize`. A PR could therefore receive additional commits without automatically running the permanent quality gate on the new head.

### Correction

- Restored `pull_request.synchronize`.
- Retained PR-number concurrency and `cancel-in-progress: true`, so obsolete revisions are cancelled instead of consuming the single dedicated runner.
- Contract tests now require the exact trigger set and concurrency rule.

The migration itself exercised this behavior: later commits produced new runs and superseded older revisions.

## Confirmed finding 3: hosted-runner shell assumptions were incompatible with Windows frontend execution

The frontend job used Bash pipelines and Linux-oriented commands. Merely replacing `ubuntu-latest` with the Windows self-hosted label would not produce a valid workflow.

### Correction

- Converted frontend install, audit, test and build steps to PowerShell.
- Preserved command exit codes after `Tee-Object` so `continue-on-error` outcomes remain trustworthy.
- Kept exact frontend artifact handoff into the Rust/Windows job.

## Confirmed finding 4: npm configuration polluted persistent global state

Quality and release workflows changed npm registry and cache with `--global`. This is acceptable on disposable runners but can affect unrelated work on a persistent machine.

### Correction

- Registry and cache are now supplied as process-scoped environment variables.
- Cache paths live under the current runner temporary directory.
- Workflow contracts reject removal of persistent-runner hygiene protections.

## Confirmed finding 5: generated dependencies and build targets accumulated on the persistent runner

The hosted workflows relied on machine disposal. On a self-hosted runner, frontend dependencies, `dist`, Rust `target` and staged release files could remain after every run and consume substantial disk space.

### Correction

- Artifacts and diagnostics are uploaded first.
- Always-running cleanup steps then remove generated frontend, Rust and staged release directories.
- Checkout cleanup remains enabled for the next run.

## Confirmed finding 6: an unnecessary Python setup stalled the self-hosted workflow

The first migration revision added `actions/setup-python` solely for the small workflow-contract test. The step stalled on the dedicated runner and introduced a toolchain the application does not otherwise require.

### Correction

- Replaced the Python contract test with `scripts/test-workflow-contracts.mjs`.
- The test runs after the already-required Node setup and before dependency installation.
- The contract rejects reintroduction of `actions/setup-python` for this purpose.

## Confirmed finding 7: the generic Rust setup action failed before project checks

`dtolnay/rust-toolchain@stable`, which worked on GitHub-hosted Windows, failed during setup on the dedicated runner before formatting, tests or builds could start.

### Correction

- Extended `scripts/rust-env.ps1` with explicit `-UseGlobalHomes` support.
- Self-hosted CI reuses the runner's user-level Cargo/Rustup homes, imports the Visual Studio x64 build environment and exposes the stable MSVC toolchain.
- `rustfmt` and `clippy` are confirmed before checks.
- Every Rust/NSIS PowerShell step sources the project bootstrap independently.
- Local developer behavior remains repository-isolated by default.
- Quality contracts reject return to the incompatible generic action in self-hosted Windows jobs.

## Product and security audit results

No additional product-code correctness defect was confirmed after reviewing the current tree.

### Capability claims

- v2rayN detection, status, open, TUN toggle, restart and item listing match their supported declarations.
- v2rayN profile selection remains explicitly experimental.
- v2rayN transport-mode and subscription operations remain explicitly unsupported and are not represented as profiles.
- Happ process/path detection and open are supported baseline behavior.
- Happ process existence alone never produces Connected.
- Happ status/toggle/transport remain opt-in experimental UI Automation.
- Happ profile/server and subscription operations remain research-required and are rejected by the backend.

### State and persistence

- Selected-client operations are serialized and stale epochs are rejected.
- Settings values and endpoint lists are normalized before persistence.
- Settings/config replacement preserves backups and rejects unsafe concurrent external changes.
- Unknown v2rayN TUN/profile selector schemas fail closed instead of inventing or retyping fields.
- Observational config reads remain non-mutating.

### Network and desktop boundaries

- Diagnostic endpoints require HTTP(S), reject private/reserved literal or resolved addresses, disable redirects and ambient proxies, and pin requests to validated DNS results.
- External-IP response bodies are bounded.
- The external diagnostics WebView is excluded from the Tauri capability allowlist.
- v2rayN process, privilege and UI actions are scoped to the configured installation.
- Happ UI Automation is scoped to the detected process and refuses ambiguous controls.

### Release boundary

- The self-hosted build job has read-only repository permissions.
- The only `contents: write` job remains isolated, hosted, checkout-free and dependent on the completed build artifact.
- Release publication verifies exact filenames, rejects extra files and checks SHA-256 before upload.

## Files changed

- `.github/workflows/windows-quality.yml`;
- `.github/workflows/release-assets.yml`;
- `scripts/test-workflow-contracts.mjs`;
- removal of `scripts/test_workflow_contracts.py`;
- `scripts/rust-env.ps1`;
- `README.md`;
- `AGENTS.md`;
- `docs/release-process.md`;
- task, decision and this report for 0024.

No application runtime source file was changed because the independent product audit did not confirm a new defect requiring such a modification.

## Verification

The implementation revision completed the permanent quality gate on the dedicated self-hosted runner:

- runtime self-hosted assignment assertions for both jobs;
- workflow trigger/runner/toolchain/security/cleanup contracts;
- reproducible frontend installation;
- high-severity frontend dependency audit;
- complete frontend test suite;
- TypeScript/Vite production build;
- complete Rust workspace formatting check;
- complete Rust test suite;
- strict default/all-target Clippy with warnings denied;
- strict release/no-default-features Clippy with warnings denied;
- `cargo check --locked`;
- locked portable Windows release build and uploaded `.exe` artifact;
- clean locked Tauri/NSIS build and uploaded installer artifact;
- diagnostic uploads and successful persistent-workspace cleanup.

The exact final PR revision is required to pass the same permanent gate before squash merge.

## Public-data review

The repository diff contains no credentials, private endpoints, subscription data, user configs, runtime logs, private local paths or personal information. Runner verification is documented only through its public GitHub runner name, OS/architecture and self-hosted status; local machine paths and machine identity from execution logs were not copied into the repository.

## Residual limitations

- The dedicated runner must be online; jobs intentionally queue rather than fall back to hosted compute.
- The stable Rust channel is not pinned to an exact compiler version. Pinning would require a separate compatibility/release decision.
- v2rayN profile selection and Happ UI Automation remain version-sensitive experimental features and continue to fail closed when the installed UI/config schema is not recognized.
- Repository-only automation cannot prove compatibility with every released or future v2rayN/Happ build; the diagnostics surfaces and explicit capability maturity remain the target-machine verification mechanism.
- Windows binaries are not code-signed because no signing certificate or signing service is configured.

## Next steps

- Keep `v2rayn-widget-ci` online for PR and release builds.
- Review disk usage periodically even though generated workspaces are now cleaned.
- Consider pinning Rust in a separate task if reproducibility requirements become stricter.
- Continue treating new external-client versions as compatibility work, not implicit support.
