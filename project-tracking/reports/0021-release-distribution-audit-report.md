# 0021 Release Distribution Audit Report

## Baseline

- Repository: `lgg/v2rayn-widget`
- Audited branch: `main`
- Exact baseline: `6ed1bc8decd1bd952e552a02a25466fe63a7157d`
- Previous change: PR #8, CI trigger hardening

## Audit of the latest CI changes

The merged `Release Quality` workflow was re-reviewed in full together with its observed run history.

Confirmed correct behavior:

- automatic PR events are limited to `opened`, `reopened` and `ready_for_review` for PRs targeting `main`;
- `pull_request.synchronize`, `push` and `pull_request_target` are absent;
- draft PRs skip both heavy jobs;
- fork PR code cannot enter either heavy job because the head repository must equal the current repository;
- manual `workflow_dispatch` remains available;
- concurrency is keyed by PR number with a ref fallback and `cancel-in-progress: true`;
- the merge commit for PR #8 created no post-merge workflow run;
- current jobs use GitHub-hosted `ubuntu-latest` and `windows-latest`, not self-hosted labels.

No regression was found in the trigger fix itself.

## Confirmed missing capability

The repository had only one workflow file: `.github/workflows/windows-quality.yml`.

It produced temporary smoke artifacts during pull-request validation, but there was no independent release workflow that:

- reacted to a published GitHub Release;
- checked out the exact release tag;
- generated stable distribution filenames;
- created a portable ZIP and checksums;
- retained a complete release artifact;
- attached distributable files to the GitHub Release.

This was a real release-process gap rather than a documentation-only issue.

## Corrections

### Separate release workflow

Added `.github/workflows/release-assets.yml` with only trusted triggers:

- `release.published`;
- `workflow_dispatch`.

The workflow has no PR, push or `pull_request_target` trigger.

It builds on `windows-latest` and:

1. checks out the exact release tag or explicit manual ref;
2. verifies Cargo and Tauri versions match;
3. verifies a release tag is valid semantic versioning and matches the application version;
4. installs and audits locked frontend dependencies;
5. builds the frontend;
6. builds the locked portable executable;
7. builds the locked NSIS installer;
8. stages portable EXE, portable ZIP, installer and SHA-256 checksums;
9. uploads all files as a 30-day Actions artifact;
10. uploads or replaces the same files on the matching GitHub Release.

When `release_tag` is supplied manually it also becomes the build ref, preventing assets built from another branch from being attached to the release.

### Permanent workflow contract test

Added `scripts/test_workflow_contracts.py` and wired it into the existing frontend CI job immediately after checkout.

The dependency-free test protects:

- exact Release Quality events;
- absence of `push`, `synchronize` and `pull_request_target`;
- draft and fork guards on both heavy jobs;
- PR-number concurrency;
- exact release workflow events;
- release-only write permission and Windows runner;
- portable, NSIS, Actions artifact, checksum and GitHub Release upload contracts.

No existing test covered workflow configuration, so a new regression test was necessary.

## Preserved behavior

Existing frontend tests, dependency audit, Rust formatting/tests/Clippy/check, portable smoke build, NSIS smoke build, diagnostics, artifacts and cleanup commands remain unchanged. The only existing workflow command added is the lightweight workflow-contract regression test.

## Distribution outputs

For version `X.Y.Z`:

- `v2rayn-widget-X.Y.Z-windows-x64-portable.exe`;
- `v2rayn-widget-X.Y.Z-windows-x64-portable.zip`;
- `v2rayn-widget-X.Y.Z-windows-x64-setup.exe`;
- `SHA256SUMS.txt`.

## Residual limitations

- Windows binaries are not code-signed because no signing certificate or secure signing service is configured.
- A real `release.published` attachment run requires publishing a release; this audit does not create a fake public release solely for testing.
- Portable and NSIS compilation remain covered by the permanent Release Quality workflow, while release trigger/security/staging/upload contracts are covered by the new regression test.
