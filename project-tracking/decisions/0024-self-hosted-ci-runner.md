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

## Persistent-runner hygiene

- Do not persist project-specific npm registry/cache configuration globally.
- Use runner-temporary cache paths through process-scoped environment variables.
- Upload required diagnostics and build artifacts before cleanup.
- Remove generated `node_modules`, frontend `dist`, Rust `target` and staged release directories after jobs.
- Keep checkout cleanup enabled.

## Enforcement

The workflow contract test must fail when:

- either quality job does not use `[self-hosted, v2rayn-widget-ci]`;
- the Windows release build uses a hosted runner;
- the isolated publisher is moved onto the self-hosted runner;
- `synchronize`, concurrency, runtime assertions or cleanup steps are removed;
- an unnecessary extra toolchain setup is introduced for workflow-only validation.

## Rationale

The dedicated Windows runner provides the intended build environment without consuming hosted build capacity. Automatic validation of every PR revision is safe when obsolete runs are cancelled. Keeping the write-enabled publisher hosted preserves a stronger security boundary: untrusted checked-out project code never executes in the job that can modify release assets.

## Consequences

- The runner service must be online for repository quality and Windows builds.
- Jobs queue rather than silently falling back to hosted runners when the custom runner is unavailable.
- Frontend and Rust/Windows quality jobs remain sequential on a single machine.
- Persistent workspace hygiene becomes a required part of workflow review.
