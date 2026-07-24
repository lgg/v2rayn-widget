# 0027 - Final Release Integrity Audit Report

## Status

Implementation in progress; runtime verification pending.

## Scope

Continued from merged PR #14 and re-audited:

- complete NSIS toolchain authenticity;
- documented local installer execution;
- caller environment and working-directory hygiene;
- release tag resolution and commit identity;
- publisher artifact allowlisting and checksum completeness;
- permanent contract coverage;
- completion state of project-tracking records.

## Confirmed findings

### Complete NSIS cache was not cryptographically approved

The existing implementation computed a full cache fingerprint but only compared the source cache with its temporary copy and the copy before/after packaging. Only `nsis_tauri_utils.dll` had a pinned hash. A modified compiler or another cache file could therefore become the self-consistent baseline.

Correction:

- pin the complete audited cache fingerprint `28852b9b39fd712258bd098f6d875b4d8053d91e704f5729f0b1e5b139971388`;
- reject any source or isolated cache with a different fingerprint;
- retain required-file, compiler-version and plugin-hash validation as independent checks.

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
- run GNU `sha256sum --check --strict` after structural validation.

### Previous tracking state remained incomplete

Task/report 0026 still described the exact-head quality run and PR merge as pending.

Correction:

- record Release Quality run #297 and merge commit `35d5ed743cc0789d438306d069ada6b47d18873f`;
- mark task 0026 completed.

## Verification

Pending:

- real Windows installer packaging using the corrected local build command;
- caller environment/location restoration assertions;
- exact pinned NSIS fingerprint validation on the dedicated runner;
- publisher validation regression cases;
- final exact-head permanent Release Quality run.

## Residual boundaries

- The manually provisioned runner cache remains an operational dependency, but its full contents are now required to match the audited fingerprint.
- WebView2 must already exist on target Windows systems.
- Windows executables remain unsigned until signing is configured.
- A hosted publisher cannot make multi-asset GitHub upload transactionally atomic; pre-upload validation minimizes but cannot eliminate a remote partial-failure boundary.
