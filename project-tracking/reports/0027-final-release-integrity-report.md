# 0027 - Final Release Integrity Audit Report

## Status

Completed and squash-merged through PR #15.

## Scope

Continued from merged PR #14 and re-audited:

- complete NSIS toolchain authenticity;
- deterministic fingerprint generation;
- documented local installer execution;
- caller environment and working-directory hygiene;
- release tag resolution and commit identity;
- publisher artifact allowlisting and checksum completeness;
- permanent contract coverage;
- completion state of project-tracking records.

## Confirmed findings and corrections

### Complete NSIS cache was not cryptographically approved

The existing implementation computed a full cache fingerprint but only compared the source cache with its temporary copy and the copy before/after packaging. Only `nsis_tauri_utils.dll` had a pinned hash. A modified compiler or another cache file could therefore become the self-consistent baseline.

Correction:

- pin the complete audited cache fingerprint;
- reject any source or isolated cache with a different fingerprint;
- retain required-file, compiler-version and plugin-hash validation as independent checks.

### Fingerprint ordering depended on machine collation

The original full-cache fingerprint used `Sort-Object FullName`. Its order could depend on current culture and absolute path rules, making a cryptographic policy potentially differ across otherwise identical machines.

Correction:

- normalize every cache file to a forward-slash relative path;
- combine it with the lowercase file SHA-256;
- sort manifest lines with `System.StringComparer.Ordinal`;
- hash the LF-joined UTF-8 manifest.

The canonical Tauri CLI 2.11.2 / NSIS 3.11 cache fingerprint is:

`e1cbd35b909809366db4f46dbfbb4da5f4c181194d00fa064f27240b091b1451`

A deliberate negative audit using the old culture-ordered value failed closed and still restored the complete caller state, proving both rejection and cleanup behavior.

### Local installer command selected the wrong Rust home

The documented `./scripts/build-installer.ps1` command invoked `rust-env.ps1` without `-UseGlobalHomes`. That selected repository-local homes and could fail even when Rust was correctly installed globally.

Correction:

- validate Rust through the common prerequisite script, which selects pre-provisioned global homes;
- snapshot and restore the complete environment and caller working directory in `finally`;
- retain temporary NSIS isolation and cleanup on both success and failure.

### Release tag checkout was ambiguous

A manual `release_tag` was passed to checkout as an unqualified ref. A branch and tag with the same name could make the source revision ambiguous.

Correction:

- qualify release tags as `refs/tags/<tag>`;
- resolve both checked-out HEAD and the peeled tag commit;
- fail unless they are identical before building or publishing.

### Publisher allowlist was only top-level

The publisher counted top-level files but did not reject nested directories or nested files in the downloaded artifact.

Correction:

- compare every recursive artifact entry with the exact four-entry allowlist;
- require every expected asset to be a regular non-symlink file.

### Checksum verification did not prove coverage

`sha256sum --check` verified the entries that existed but did not prove that every binary appeared exactly once.

Correction:

- require exactly three checksum lines;
- accept only the portable executable, portable ZIP and setup executable;
- reject malformed, duplicate, missing or unexpected targets;
- run GNU `sha256sum --check --strict` after structural validation;
- submit all validated assets in one `gh release upload` invocation.

### Previous tracking state remained incomplete

Task/report 0026 still described the exact-head quality run and PR merge as pending.

Correction:

- record Release Quality run #297 and merge commit `35d5ed743cc0789d438306d069ada6b47d18873f`;
- mark task/report 0026 completed.

## Runtime verification

Temporary Audit 0027 Installer Integrity run #7 (`30072641292`) completed successfully on SHA `cf06ebd1f2c39f4e63d32d31f8f1d58ffdd0e2ac`.

### Windows installer audit

The self-hosted Windows job successfully:

- checked out without persisted credentials;
- passed both permanent contract suites;
- ran the documented `scripts/build-installer.ps1` command;
- validated Node.js, global Rust/MSVC, locked Tauri CLI and canonical NSIS fingerprint;
- restored locked npm dependencies with lifecycle scripts disabled;
- passed npm audit and frontend tests;
- completed a full optimized Tauri/NSIS release build;
- produced exactly one setup executable and one generated `installer.nsi`;
- confirmed the canonical cache fingerprint before and after packaging;
- proved that the complete caller environment-variable set and working directory were restored exactly;
- uploaded audited installer/diagnostic artifacts and completed cleanup.

The setup executable was created but never launched.

### Hosted publisher fixtures

The isolated hosted-Linux job accepted a valid four-file distribution and rejected each of these fixtures:

- nested unexpected file;
- duplicate checksum entry;
- missing checksum entry;
- symlinked expected asset;
- unexpected checksum target.

The temporary audit workflow was removed from the branch after both jobs passed and did not enter `main`.

## Permanent verification

Final exact-head Release Quality run #309 (`30073241976`) completed successfully on SHA `76efa4d29e518fe03b27a799c1e1e06fc24a666d`.

Both permanent jobs passed every required step:

- checkout without persisted credentials;
- runner identity checks;
- Node.js and canonical NSIS/Tauri prerequisite validation;
- both permanent contract suites;
- locked npm restore with lifecycle scripts disabled;
- npm audit, frontend tests and production build;
- Rust/MSVC/Windows SDK validation;
- complete Rust formatting check;
- Rust tests;
- strict all-targets Clippy;
- strict release/no-default-features Clippy;
- locked Rust check;
- portable release build and artifact upload;
- diagnostics upload and always-running cleanup.

PR #15 was squash-merged into `main` as commit `c1686aa6e8374d348ef9c097671296c181704e06` on 2026-07-24.

## Residual boundaries

- The manually provisioned runner cache remains an operational dependency, but its complete contents must match the canonical approved fingerprint.
- WebView2 must already exist on target Windows systems.
- Windows executables remain unsigned until signing is configured.
- A hosted publisher cannot make GitHub's remote multi-asset update transactionally atomic; exhaustive pre-upload validation and one upload invocation minimize but cannot eliminate a remote transport/service partial-failure boundary.
