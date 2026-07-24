# Release process

## Automated distribution workflow

`.github/workflows/release-assets.yml` is separate from the pull-request `Release Quality` workflow.

It runs automatically when a GitHub Release is published and can also be started manually with `workflow_dispatch`.

For a published release the workflow:

1. checks out the exact release tag;
2. verifies that the semantic version in the tag matches both `src/tauri/Cargo.toml` and `src/tauri/tauri.conf.json`;
3. verifies pre-provisioned Node.js, npm, Rust/MSVC, rustfmt, Clippy and NSIS without installing or updating them;
4. restores and audits locked frontend dependencies locally with lifecycle scripts disabled;
5. builds the production frontend;
6. builds the locked Windows portable executable;
7. builds the locked Tauri NSIS installer with the already-installed `makensis.exe`;
8. creates stable distribution filenames and a portable ZIP;
9. creates `SHA256SUMS.txt` for all distributable files;
10. uploads the complete directory as a GitHub Actions artifact;
11. transfers that verified artifact to an isolated publishing job;
12. checks the exact file allowlist and SHA-256 manifest;
13. attaches every generated file to the published GitHub Release.

The workflow creates the setup executable but never launches it.

## Runner assignment

The Windows build job executes on the dedicated repository runner:

```yaml
runs-on: [self-hosted, v2rayn-widget-ci]
```

It logs the selected runner identity and fails if GitHub does not report a self-hosted environment. Generated dependencies, build targets and staged release files are removed after artifact upload because the runner workspace is persistent.

The runner is validation/build-only. CI contains no `rustup toolchain install`, `rustup component add`, `actions/setup-*`, `winget`, Chocolatey, Scoop, `msiexec`, `RunAs` or equivalent provisioning commands. Required tools must be installed manually before the runner service starts. Missing prerequisites fail the job without requesting elevation.

The write-enabled `publish-release` job intentionally remains on `ubuntu-latest`. It does not check out or execute repository code; it only downloads the build artifact, verifies its exact contents and checksums, and attaches the allowlisted files to the release.

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
2. Confirm that the runner already has Node.js 22+, npm, stable x64 MSVC Rust, rustfmt, Clippy, Visual Studio 2022 C++ Build Tools and NSIS.
3. Merge the version update after `Release Quality` passes on `v2rayn-widget-ci`.
4. Create and publish a GitHub Release with a matching semantic-version tag such as `v1.2.3`.
5. Open the `Build Release Assets` workflow run and verify that the self-hosted Windows build and isolated publisher completed successfully.
6. Confirm that the four generated files are attached to the release.

A mismatched or malformed tag fails before any distribution files are uploaded.

## Manual build or recovery

Open **Actions → Build Release Assets → Run workflow**.

- Set `ref` to a branch, tag or commit to create an Actions artifact without modifying a GitHub Release.
- Set `release_tag` to an existing semantic-version release tag to build that exact tag and upload or replace its attached assets.

When `release_tag` is supplied, it takes precedence over `ref`, preventing a different branch from being attached to that release.

## Security and concurrency

- The workflow has no `push`, `pull_request` or `pull_request_target` trigger.
- Release attachment is available only for trusted release/manual events.
- The self-hosted Windows build job has read-only repository permissions while it executes checked-out project code.
- The Windows job verifies tools but never provisions, updates or elevates them.
- Frontend dependencies are restored into the checkout with `npm ci --ignore-scripts`.
- The produced portable and setup executables are never launched by CI.
- Only the isolated hosted Linux publishing job receives `contents: write`; it does not check out or execute repository code.
- The publishing job accepts exactly four expected files, rejects extras and verifies `SHA256SUMS.txt` before upload.
- Runs are grouped by release tag or manual ref with `cancel-in-progress: true`.
- Project-specific npm configuration is process-scoped and generated build directories are cleaned after upload.
