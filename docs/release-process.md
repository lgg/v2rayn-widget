# Release process

## Automated distribution workflow

`.github/workflows/release-assets.yml` is separate from the pull-request `Release Quality` workflow.

It runs automatically when a GitHub Release is published and can also be started manually with `workflow_dispatch`.

For a published release the workflow:

1. checks out the exact qualified `refs/tags/<tag>` release ref without persisting GitHub credentials;
2. verifies that checked-out `HEAD` is exactly the peeled release-tag commit;
3. verifies that the semantic version in the tag matches both `src/tauri/Cargo.toml` and `src/tauri/tauri.conf.json`;
4. verifies pre-provisioned Node.js, npm, Rust/MSVC, rustfmt, Clippy and the canonical Tauri NSIS cache without installing or updating them;
5. restores and audits locked frontend dependencies locally with lifecycle scripts disabled;
6. verifies the locked Tauri CLI version from `package-lock.json`;
7. builds the production frontend;
8. builds the locked Windows portable executable;
9. copies the approved NSIS cache into isolated runner-temporary storage, builds the locked Tauri NSIS installer and rejects any cache mutation;
10. verifies the generated NSIS script is current-user only and keeps every rendered WebView2 installer definition disabled;
11. requires exactly one installer output;
12. creates stable distribution filenames and a portable ZIP;
13. creates `SHA256SUMS.txt` and requires exactly four distributable files;
14. uploads the complete directory as a GitHub Actions artifact;
15. transfers that artifact to an isolated publishing job;
16. checks the exact recursive non-symlink allowlist and complete strict SHA-256 manifest;
17. attaches the complete allowlisted set to the published GitHub Release in one upload invocation.

The workflow creates the setup executable but never launches it.

## Exact toolchain policy

`scripts/ci-toolchain-policy.json` defines the validation contract for:

- minimum Node.js version;
- exact Tauri CLI version;
- Rust target host;
- Tauri NSIS version;
- exact NSIS files required by the pinned Tauri bundler;
- expected SHA-1 for `nsis_tauri_utils.dll`;
- canonical SHA-256 fingerprint of the complete Tauri NSIS cache.

The policy must remain synchronized with `src/frontend/package-lock.json`, the provisioned runner cache and contract tests. The prerequisite script validates the exact `%LOCALAPPDATA%\tauri\NSIS` directory used by Tauri; an unrelated `makensis.exe` from PATH is not accepted.

The complete-cache fingerprint is deterministic and locale-independent. Validation creates `relative/path|file-sha256` entries with normalized forward slashes, sorts them through `System.StringComparer.Ordinal`, joins them with LF, then hashes that UTF-8 manifest with SHA-256.

For Tauri CLI 2.11.2 and NSIS 3.11 the approved canonical fingerprint is:

`e1cbd35b909809366db4f46dbfbb4da5f4c181194d00fa064f27240b091b1451`

Both the persistent source cache and its isolated temporary copy must match this approved value. The isolated copy is fingerprinted again after bundling. If any source, copied or post-build cache differs, the job fails instead of downloading, repairing or accepting modified tooling.

## Installer behavior

`src/tauri/tauri.installer.conf.json` explicitly configures:

- NSIS `installMode: currentUser`, so installation is scoped to the current account and does not require Administrator access;
- WebView2 `webviewInstallMode: skip`, so the setup executable does not download or run a WebView2 installer.

The generated `installer.nsi` is inspected to require `RequestExecutionLevel user` and empty rendered values for `INSTALLWEBVIEW2MODE`, `WEBVIEW2BOOTSTRAPPERPATH`, `WEBVIEW2INSTALLERPATH` and `MINIMUMWEBVIEW2VERSION`.

WebView2 must therefore already be available on the target Windows system. This is an intentional trade-off to keep installation dependency-neutral and free from unexpected UAC prompts.

## Runner assignment

The Windows build job executes on the dedicated repository runner:

```yaml
runs-on: [self-hosted, v2rayn-widget-ci]
```

It logs the selected runner identity and fails if GitHub does not report a self-hosted environment. Official Actions are pinned to immutable commit SHAs, checkout credentials are not persisted, and generated dependencies, temporary npm caches, fingerprints, build targets and staged release files are removed after artifact upload because the runner workspace is persistent.

The runner is validation/build-only. CI contains no `rustup toolchain install`, `rustup component add`, `actions/setup-*`, `winget`, Chocolatey, Scoop, `msiexec`, `RunAs`, download helper or equivalent provisioning command. Required tools must be installed manually before the runner service starts. Missing, incomplete, modified or mismatched prerequisites fail the job without requesting elevation or repairing them.

The write-enabled `publish-release` job intentionally remains on `ubuntu-latest`. It does not check out or execute repository code; it only downloads the build artifact, verifies its exact recursive contents and checksums, and attaches the allowlisted files to the release.

## Generated files

For application version `X.Y.Z`:

- `v2rayn-widget-X.Y.Z-windows-x64-portable.exe`;
- `v2rayn-widget-X.Y.Z-windows-x64-portable.zip`;
- `v2rayn-widget-X.Y.Z-windows-x64-setup.exe`;
- `SHA256SUMS.txt`.

`SHA256SUMS.txt` must contain exactly one unique strict SHA-256 entry for each of the three binary assets. It does not checksum itself.

GitHub also provides its standard source-code archives for every release.

## Publishing a release

1. Update the version in both:
   - `src/tauri/Cargo.toml`;
   - `src/tauri/tauri.conf.json`.
2. Confirm that the runner already satisfies `scripts/ci-toolchain-policy.json`, including the complete canonical Tauri NSIS cache.
3. Merge the version update after `Release Quality` passes on `v2rayn-widget-ci`.
4. Create and publish a GitHub Release with a matching semantic-version tag such as `v1.2.3`.
5. Open the `Build Release Assets` workflow run and verify that the self-hosted Windows build and isolated publisher completed successfully.
6. Confirm that the four generated files are attached to the release.

A mismatched, malformed or ambiguously resolved tag fails before any distribution files are uploaded.

## Manual build or recovery

Open **Actions → Build Release Assets → Run workflow**.

- Set `ref` to a branch, tag or commit to create an Actions artifact without modifying a GitHub Release.
- Set `release_tag` to an existing semantic-version release tag to build the exact qualified tag and upload or replace its attached assets.

When `release_tag` is supplied, it takes precedence over `ref`. The workflow checks out `refs/tags/<release_tag>` and proves that checked-out `HEAD` matches the peeled tag commit before any build output can be published.

For an equivalent local installer build, run:

```powershell
./scripts/build-installer.ps1
```

The script uses the globally pre-provisioned Rust/MSVC toolchain, validates the canonical NSIS cache, packages against an isolated temporary copy and restores the caller's complete environment and working directory even when the build fails.

## Security and concurrency

- The workflow has no `push`, `pull_request` or `pull_request_target` trigger.
- Release attachment is available only for trusted release/manual events.
- The self-hosted Windows build job has read-only repository permissions while it executes checked-out project code.
- Every official Action is pinned to a full commit SHA.
- Checkout credentials are removed immediately after checkout and are not persisted for later steps.
- The Windows job validates canonical tools and caches but never provisions, updates, repairs or elevates them.
- Frontend dependencies are restored into the checkout with `npm ci --ignore-scripts`.
- The persistent NSIS source cache is not exposed directly to bundling.
- Source, isolated-before and isolated-after fingerprints must all match the canonical policy value.
- The installer is current-user only and does not install WebView2.
- The produced portable and setup executables are never launched by CI.
- Only the isolated hosted Linux publishing job receives `contents: write`; it does not check out or execute repository code.
- The publishing job accepts exactly four recursive regular-file entries, rejects nested extras and symlinks, and requires an exact duplicate-free three-entry checksum manifest.
- Release assets are passed to one `gh release upload` invocation after all validation succeeds.
- Runs are grouped by release tag or manual ref with `cancel-in-progress: true`.
- Process-scoped npm caches and generated build directories are removed after upload.
