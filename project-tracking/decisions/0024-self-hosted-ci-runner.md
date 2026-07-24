# 0024 - Dedicated Self-hosted CI Runner

## Status

Accepted.

## Decision

Repository-owned quality jobs and Windows build jobs must target:

```yaml
runs-on: [self-hosted, v2rayn-widget-ci]
```

This applies to:

- both jobs in `Release Quality`;
- the Windows build job in `Build Release Assets`;
- future jobs that execute, test or package checked-out project code for this repository.

The isolated release publishing job remains on `ubuntu-latest`. It is the only job with `contents: write`, downloads only the previously built artifact, verifies the exact file allowlist and checksums, and does not check out or execute repository code.

## Trigger policy

`Release Quality` runs for non-draft same-repository pull requests on:

- `opened`;
- `reopened`;
- `ready_for_review`;
- `synchronize`.

PR-number concurrency with `cancel-in-progress: true` ensures that only the newest revision consumes the single dedicated runner.

## Rust toolchain policy

The Windows self-hosted jobs use the repository-owned `scripts/rust-env.ps1` bootstrap instead of a third-party Rust setup action.

- CI calls the script with `-UseGlobalHomes` so the persistent runner reuses its user-level Cargo/Rustup installation and registries.
- The script imports the installed Visual Studio x64 C++ environment and exposes the stable MSVC toolchain explicitly.
- `rustfmt` and `clippy` components are installed or confirmed before checks.
- Every independent PowerShell step sources the script because GitHub Actions step environments do not persist automatically.
- Local developer commands keep the existing repository-isolated Cargo/Rustup homes unless `-UseGlobalHomes` is explicitly selected.

This avoids relying on setup-action assumptions that did not hold on the dedicated runner while preserving the same Rust commands and locked dependency graph.

## Persistent-runner hygiene

- Do not persist project-specific npm registry/cache configuration globally.
- Use runner-temporary npm cache paths through process-scoped environment variables.
- Reuse the runner's user-level Cargo/Rustup homes; do not create a complete toolchain under every checkout.
- Upload required diagnostics and build artifacts before cleanup.
- Remove generated `node_modules`, frontend `dist`, Rust `target` and staged release directories after jobs.
- Keep checkout cleanup enabled.

## Enforcement

The workflow contract test must fail when:

- either quality job does not use `[self-hosted, v2rayn-widget-ci]`;
- the Windows release build uses a hosted runner;
- the isolated publisher is moved onto the self-hosted runner;
- `synchronize`, concurrency, runtime assertions or cleanup steps are removed;
- an unnecessary Python setup is introduced for workflow-only validation;
- the self-hosted Windows jobs return to an incompatible generic Rust setup action instead of the project bootstrap.

## Rationale

The dedicated Windows runner provides the intended build environment without consuming hosted build capacity. Automatic validation of every PR revision is safe when obsolete runs are cancelled. Keeping the write-enabled publisher hosted preserves a stronger security boundary: checked-out project code never executes in the job that can modify release assets.

## Consequences

- The runner service must be online for repository quality and Windows builds.
- Jobs queue rather than silently falling back to hosted runners when the custom runner is unavailable.
- Frontend and Rust/Windows quality jobs remain sequential on a single machine.
- Persistent workspace and toolchain hygiene become required parts of workflow review.
- The stable Rust toolchain may still advance when the bootstrap installs or updates `stable`; introducing a pinned toolchain would require a separate compatibility decision.
