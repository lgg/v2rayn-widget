# 0024 - Self-hosted Runner Migration and Full Project Audit

## Metadata

| Field | Value |
| --- | --- |
| Status | In progress |
| Priority | P1 |
| Type | CI reliability / full-project audit |
| Baseline | `main@5b281bdafd0c15d749ab23726db219b9d0e98dac` |

## Context

The repository has a dedicated Windows self-hosted GitHub Actions runner carrying the custom label `v2rayn-widget-ci`. The permanent quality and Windows release-build workflows were still assigned to GitHub-hosted runners, so repository work did not use the intended machine. The quality trigger also skipped `pull_request.synchronize`, meaning later PR revisions were not automatically revalidated.

A persistent runner additionally requires stricter workspace and tool configuration hygiene than an ephemeral hosted runner.

## Goals

- Route every repository-owned quality and Windows build job to `[self-hosted, v2rayn-widget-ci]`.
- Verify the assignment at runtime and protect it with workflow contract tests.
- Revalidate every PR revision while cancelling superseded runs.
- Avoid persistent global tool configuration and generated-file accumulation on the runner.
- Perform another independent audit of declared product behavior, frontend/backend contracts, persistence, security boundaries, tests and release flow.
- Fix every confirmed defect with regression coverage.

## In scope

- `.github/workflows/windows-quality.yml`;
- `.github/workflows/release-assets.yml`;
- workflow contract tests;
- runner environment assertions and persistent-workspace cleanup;
- README, release documentation, project rules and decision record;
- main widget, Settings, Debug Tools and Happ Setup surfaces;
- generic Tauri dispatcher and v2rayN/Happ adapters;
- settings/config persistence and external URL handling;
- Windows process, privilege and UI Automation boundaries;
- frontend tests, Rust formatting/tests/Clippy/check, portable and NSIS builds.

## Out of scope

- provisioning or reconfiguring the runner service itself;
- adding subscriptions or new proxy-client adapters;
- code signing without an available certificate/signing service;
- claiming compatibility with every future v2rayN or Happ UI version.

## Acceptance criteria

- [x] Both Release Quality jobs target `[self-hosted, v2rayn-widget-ci]`.
- [x] The Windows release-build job targets `[self-hosted, v2rayn-widget-ci]`.
- [x] The isolated write-enabled release publisher remains hosted and does not check out repository code.
- [x] PR `synchronize` starts validation for each new revision; concurrency cancels obsolete runs.
- [x] Runtime steps confirm the self-hosted environment and log runner identity.
- [x] Workflow contract tests reject hosted quality/Windows-build assignment and redundant Python setup.
- [x] npm registry/cache configuration is process-scoped.
- [x] large generated workspaces are cleaned after artifact upload.
- [ ] Final workflow contracts, dependency audit, frontend tests and production build pass.
- [ ] Final Rust formatting, tests, strict Clippy variants and locked check pass.
- [ ] Final portable and NSIS smoke artifacts are produced on the self-hosted runner.
- [ ] Documentation and public-data review pass.
- [ ] PR is squash-merged into `main`.

## Verification plan

1. Open a PR and confirm a job is accepted by the custom runner label.
2. Confirm the runtime self-hosted assertion and runner identity output.
3. Push a later revision and verify a `synchronize` run supersedes the prior run.
4. Run workflow contract tests before dependency installation.
5. Run the complete permanent frontend and Rust/Windows quality gate.
6. Review final diff, documentation, permissions, artifacts and retained diagnostics.
7. Squash-merge only the exact green PR revision.

## Risks and mitigations

- **Persistent global state:** use process-scoped npm variables and cleanup generated directories.
- **Stale PR validation:** restore `synchronize` and retain PR-number concurrency with cancellation.
- **Wrong runner:** require both `self-hosted` and `v2rayn-widget-ci`, then assert `runner.environment` at runtime.
- **Single-runner contention:** keep frontend and Rust jobs sequential and cancel obsolete runs.
- **Publisher trust boundary:** keep the only write-enabled job hosted, isolated from checked-out repository code.
- **External client UI drift:** preserve explicit experimental capability labels and fail-closed UI Automation.

## Related work

- Decision: `project-tracking/decisions/0024-self-hosted-ci-runner.md`.
- Report: `project-tracking/reports/0024-self-hosted-runner-and-full-audit-report.md`.
- Pull request: #12.
