# 0024 - Self-hosted Runner Migration and Full Project Audit

## Metadata

| Field | Value |
| --- | --- |
| Status | Completed |
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
- [x] Self-hosted Windows jobs use the project Rust/MSVC bootstrap instead of the incompatible generic setup action.
- [x] npm registry/cache configuration is process-scoped.
- [x] Large generated workspaces are cleaned after artifact upload.
- [x] Final workflow contracts, dependency audit, frontend tests and production build pass.
- [x] Final Rust formatting, tests, strict Clippy variants and locked check pass.
- [x] Final portable and NSIS smoke artifacts are produced on the self-hosted runner.
- [x] Documentation and public-data review pass.
- [x] PR is squash-merged into `main`.

## Verification completed

1. Opened PR #12 and confirmed jobs were accepted by the custom runner labels.
2. Confirmed runtime self-hosted assertions, Windows X64 environment and actual runner name `v2rayn-widget-runner-1213`.
3. Pushed later revisions and confirmed `synchronize` runs replaced obsolete revisions through concurrency cancellation.
4. Ran Node-based workflow contracts before dependency installation.
5. Ran the complete permanent frontend and Rust/Windows quality gate.
6. Produced and uploaded both portable and NSIS smoke artifacts.
7. Reviewed the final diff, documentation, permissions, artifacts and retained diagnostics.
8. Squash-merged only the exact green PR revision.

## Risks and mitigations

- **Persistent global state:** process-scoped npm variables, runner-temporary npm caches, reusable user-level Cargo/Rustup homes and generated-directory cleanup.
- **Stale PR validation:** `synchronize` plus PR-number concurrency and cancellation.
- **Wrong runner:** both required labels plus runtime self-hosted assertion and identity logging.
- **Single-runner contention:** sequential frontend/Rust jobs and cancellation of obsolete revisions.
- **Publisher trust boundary:** only the hosted checkout-free publisher receives `contents: write`.
- **External client UI drift:** explicit experimental capability labels and fail-closed UI Automation/config behavior.

## Related work

- Decision: `project-tracking/decisions/0024-self-hosted-ci-runner.md`.
- Report: `project-tracking/reports/0024-self-hosted-runner-and-full-audit-report.md`.
- Pull request: #12.
