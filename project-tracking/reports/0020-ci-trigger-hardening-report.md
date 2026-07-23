# 0020 CI Trigger Hardening Report

## Baseline

- Repository: `lgg/v2rayn-widget`
- Audited default branch: `main`
- Exact baseline: `86bb818c2104ce1b99d5e3b66e3840ea9c75df6c`
- The repository has no `master` branch.

## Workflow inventory

The complete repository history contains one heavy GitHub Actions workflow:

- `.github/workflows/windows-quality.yml` (`Release Quality`)

No second workflow file can launch the frontend tests, Rust checks, portable release build or NSIS packaging. The workflow currently uses GitHub-hosted `ubuntu-latest` and `windows-latest` runners; the same-repository guard also prevents untrusted fork code from reaching these jobs if the runner labels are changed later.

## Previous behavior

The previous trigger configuration used unfiltered `pull_request` plus `push` to `main`.

Consequences verified from recent workflow history:

- every new commit in an already-open PR generated a `pull_request.synchronize` run;
- concurrency cancelled the preceding run but did not stop the new run from being created;
- merging to `main` also matched the `push` trigger and created a separate post-merge run;
- draft PRs matched the default `pull_request.opened` event.

## Corrected behavior

Automatic full CI is limited to pull requests targeting `main` on:

- `opened`;
- `reopened`;
- `ready_for_review`.

`workflow_dispatch` remains enabled for deliberate manual runs.

The workflow has no `push`, `synchronize` or `pull_request_target` trigger.

Both heavy jobs require either a manual dispatch or a non-draft PR whose head repository exactly matches the current repository. This prevents fork code from executing in the heavy jobs and prevents draft PRs from allocating their runners.

Concurrency is keyed by workflow plus PR number, with a ref fallback for manual dispatch, and uses `cancel-in-progress: true`.

## Preserved implementation

The existing dependency audit, frontend tests/build, Rust formatting/tests/Clippy/check, release build, NSIS packaging, artifact retention, diagnostics, cache setup and failure aggregation commands are unchanged.

No repository test pins the old workflow event configuration, so no existing test required an update.

## Experimental verification

1. PR #8 was opened as draft. The `opened` event produced a skipped workflow run; the frontend job was skipped before runner allocation and the dependent Windows job was not created.
2. PR #8 was changed to Ready for review. The `ready_for_review` event produced one full `Release Quality` run.
3. This report was committed after the PR was already open and Ready. Because `synchronize` is not subscribed, the commit must not create a workflow run. The exact resulting SHA and API observation are recorded in the final PR description after verification.
4. The final head is verified through a deliberate `reopened` event before merge.

## Manual rerun

Use GitHub **Actions → Release Quality → Run workflow**, select the branch/ref and confirm **Run workflow**.
