# Release process

## Automated distribution workflow

`.github/workflows/release-assets.yml` is separate from the pull-request `Release Quality` workflow.

It runs automatically when a GitHub Release is published and can also be started manually with `workflow_dispatch`.

For a published release the workflow:

1. checks out the exact release tag without persisting GitHub credentials;
2. verifies that the semantic version in the tag matches both `src/tauri/Cargo.toml` and `src/tauri/tauri.conf.json`;
3. verifies pre-provisioned Node.js, npm, Rust/MSVC, rustfmt, Clippy and the exact Tauri NSIS cache without installing or updating them;
4. restores and audits locked frontend dependencies locally with lifecycle scripts disabled;
5. verifies the locked Tauri CLI version from `package-lock.json`;
6. builds the production frontend;
7. builds the locked Windows portable executable;
8. fingerprints `%LOCALAPPDATA%\tauri\NSIS`, builds the locked Tauri NSIS installer and rejects any cache mutation;
9. requires exactly one installer output;
10. creates stable distribution filenames and a portable ZIP;
11. creates `SHA256SUMS.txt` and requires exactly four distributable files;
12. uploads the complete directory as a GitHub Actions artifact;
13. transfers that verified artifact to an isolated publishing job;
14. checks the exact file allowlist and SHA-256 manifest;
15. attaches every generated file to the published GitHub Release.

The workflow creates the setup executable but never launches it.

## Exact toolchain policy

`scripts/ci-toolchain-policy.json` defines the validation contract for:

- minimum Node.js version;
- exact Tauri CLI version;
- Rust target host;
- Tauri NSIS version;
- exact NSIS files required by the pinned Tauri bundler;
- expected SHA-1 for `nsis_tauri_utils.dll`.

The policy must remain synchronized with `src/frontend/package-lock.json`. The prerequisite script validates the exact `%LOCALAPPDATA%\tauri\NSIS` directory used by Tauri; an unrelated `makensis.exe` from PATH is not accepted.

The release build records a deterministic fingerprint of the entire NSIS cache before and after bundling. If Tauri downloads, repairs, replaces or otherwise changes any cached tool file, the build fails instead of silently accepting provisioning.

## Installer behavior

`src/tauri/tauri.installer.conf.json` explicitly configures:

- NSIS `installMode: currentUser`, so installation is scoped to the current account and does not require Administrator access;
- WebView2 `webviewInstallMode: skip`, so the setup executable does not download or run a WebView2 installer.

WebView2 must therefore already be available on the target Windows system. This is an intentional trade-off to keep installation dependency-neutral and free from unexpected UAC prompts.

## Runner assignment

The Windows build job executes on the dedicated repository runner:

```yaml
runs-on: [self-hosted, v2rayn-widget-ci]
```

It logs the selected runner identity and fails if GitHub does not report a self-hosted environment. Official Actions are pinned to immutable commit SHAs, checkout credentials are not persisted, and generated dependencies, temporary npm caches, fingerprints, build targets and staged release files are removed after artifact upload because the runner workspace is persistent.

The runner is validation/build-only. CI contains no `rustup toolchain install`, `rustup component add`, `actions/setup-*`, `winget`, Chocolatey, Scoop, `msiexec`, `RunAs`, download helper or equivalent provisioning command. Required tools must be installed manually before the runner service starts. Missing, incomplete or mismatched prerequisites fail the job without requesting elevation or repairing them.

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
2. Confirm that the runner already satisfies `scripts/ci-toolchain-policy.json`, including the complete exact Tauri NSIS cache.
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
- Every official Action is pinned to a full commit SHA.
- Checkout credentials are removed immediately after checkout and are not persisted for later steps.
- The Windows job validates exact tools and caches but never provisions, updates, repairs or elevates them.
- Frontend dependencies are restored into the checkout with `npm ci --ignore-scripts`.
- The NSIS cache must remain byte-for-byte equivalent according to its deterministic fingerprint during packaging.
- The installer is current-user only and does not install WebView2.
- The produced portable and setup executables are never launched by CI.
- Only the isolated hosted Linux publishing job receives `contents: write`; it does not check out or execute repository code.
- The publishing job accepts exactly four expected files, rejects extras and verifies `SHA256SUMS.txt` before upload.
- Runs are grouped by release tag or manual ref with `cancel-in-progress: true`.
- Process-scoped npm caches and generated build directories are removed after upload.
