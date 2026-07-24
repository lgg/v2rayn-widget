# 0024 - Dedicated Self-hosted CI Runner

## Status

Accepted, with tool provisioning policy superseded by decision 0025.

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

## Toolchain policy

The self-hosted runner reuses its user-level Cargo/Rustup installation and imports the installed Visual Studio x64 C++ environment through `scripts/rust-env.ps1`.

The earlier decision to bootstrap or confirm Rust components inside CI is superseded. Under decision 0025, workflows only validate pre-provisioned Node.js, Rust/MSVC, rustfmt, Clippy and NSIS. They do not install or update toolchains, run package-manager installers, request elevation or execute generated setup files.

Local developer commands may still use `scripts/rust-env.ps1 -Bootstrap` outside GitHub Actions. The script rejects bootstrap whenever `GITHUB_ACTIONS=true`.

## Persistent-runner hygiene

- Do not persist project-specific npm registry/cache configuration globally.
- Use runner-temporary npm cache paths through process-scoped environment variables.
- Restore frontend dependencies inside the checkout with lifecycle scripts disabled.
- Reuse the runner's existing user-level Cargo/Rustup homes.
- Upload required diagnostics and build artifacts before cleanup.
- Remove generated `node_modules`, frontend `dist`, Rust `target` and staged release directories after jobs.
- Keep checkout cleanup enabled.

## Enforcement

The workflow contract test must fail when:

- either quality job does not use `[self-hosted, v2rayn-widget-ci]`;
- the Windows release build uses a hosted runner;
- the isolated publisher is moved onto the self-hosted runner;
- `synchronize`, concurrency, runtime assertions or cleanup steps are removed;
- a setup action, toolchain installer, system package manager, elevation command or generated installer execution is introduced;
- NSIS packaging returns to the normal PR quality workflow;
- local dependency restoration enables npm lifecycle scripts.

## Rationale

The dedicated Windows runner provides the intended build environment without consuming hosted build capacity. Automatic validation of every PR revision is safe when obsolete runs are cancelled. Keeping the write-enabled publisher hosted preserves a stronger security boundary: checked-out project code never executes in the job that can modify release assets.

The runner is also an interactive workstation. Validation-only jobs avoid UAC prompts, machine mutation and nondeterministic tool provisioning.

## Consequences

- The runner service must be online for repository quality and Windows builds.
- Jobs queue rather than silently falling back to hosted compute when the custom runner is unavailable.
- Frontend and Rust/Windows quality jobs remain sequential on a single machine.
- All required build tools must be provisioned manually before the runner starts.
- Missing prerequisites fail the job instead of being installed automatically.
- PR quality verifies portable builds; NSIS packaging is reserved for the trusted release workflow.

## Related decision

- `project-tracking/decisions/0025-validation-only-self-hosted-ci.md`.
