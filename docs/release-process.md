# Release process

## Automated distribution workflow

`.github/workflows/release-assets.yml` is separate from the pull-request `Release Quality` workflow.

It runs automatically when a GitHub Release is published and can also be started manually with `workflow_dispatch`.

For a published release the workflow:

1. checks out the exact release tag;
2. verifies that the semantic version in the tag matches both `src/tauri/Cargo.toml` and `src/tauri/tauri.conf.json`;
3. installs and audits locked frontend dependencies;
4. builds the production frontend;
5. builds the locked Windows portable executable;
6. builds the locked Tauri NSIS installer;
7. creates stable distribution filenames and a portable ZIP;
8. creates `SHA256SUMS.txt` for all distributable files;
9. uploads the complete directory as a GitHub Actions artifact;
10. transfers that verified artifact to an isolated publishing job;
11. checks the exact file allowlist and SHA-256 manifest;
12. attaches every generated file to the published GitHub Release.

## Generated files

For application version `X.Y.Z`:

- `v2rayn-widget-X.Y.Z-windows-x64-portable.exe`;
- `v2rayn-widget-X.Y.Z-windows-x64-portable.zip`;
- `v2rayn-widget-X.Y.Z-windows-x64-setup.exe`;
- `SHA256SUMS.txt`.

GitHub also provides its standard source-code archives for every release.

## Publishing a release

1. Update the version in both:
   - `src/tauri/Cargo.toml`;
   - `src/tauri/tauri.conf.json`.
2. Merge the version update after `Release Quality` passes.
3. Create and publish a GitHub Release with a matching semantic-version tag such as `v1.2.3`.
4. Open the `Build Release Assets` workflow run and verify that it completed successfully.
5. Confirm that the four generated files are attached to the release.

A mismatched or malformed tag fails before any distribution files are uploaded.

## Manual build or recovery

Open **Actions → Build Release Assets → Run workflow**.

- Set `ref` to a branch, tag or commit to create an Actions artifact without modifying a GitHub Release.
- Set `release_tag` to an existing semantic-version release tag to build that exact tag and upload or replace its attached assets.

When `release_tag` is supplied, it takes precedence over `ref`, preventing a different branch from being attached to that release.

## Security and concurrency

- The workflow has no `push`, `pull_request` or `pull_request_target` trigger.
- Release attachment is available only for trusted release/manual events.
- The Windows build job has read-only repository permissions while it executes checked-out project code.
- Only the isolated Linux publishing job receives `contents: write`; it does not check out or execute repository code.
- The publishing job accepts exactly four expected files, rejects extras and verifies `SHA256SUMS.txt` before upload.
- Runs are grouped by release tag or manual ref with `cancel-in-progress: true`.
