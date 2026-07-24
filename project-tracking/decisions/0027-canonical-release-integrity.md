# 0027 - Canonical Release Integrity Policy

## Status

Accepted.

## Decision

Release tooling must fail closed against a canonical, cryptographically approved toolchain and exact distribution structure. Self-consistent comparison alone is insufficient: the source baseline itself must be pinned and independently approved.

## Canonical NSIS cache

`scripts/ci-toolchain-policy.json` pins the complete Tauri NSIS cache fingerprint calculated from:

1. every regular file recursively below `%LOCALAPPDATA%\tauri\NSIS`;
2. a normalized forward-slash relative path;
3. the lowercase SHA-256 hash of that file;
4. one `relative/path|sha256` line per file;
5. strict ordinal sorting through `System.StringComparer.Ordinal`;
6. UTF-8 encoding and SHA-256 of the joined manifest.

The accepted canonical fingerprint for the Tauri CLI 2.11.2 / NSIS 3.11 cache is:

`e1cbd35b909809366db4f46dbfbb4da5f4c181194d00fa064f27240b091b1451`

Validation also retains the exact required-file list, compiler version and `nsis_tauri_utils.dll` SHA-1 as independent checks.

## Local installer command

The documented `scripts/build-installer.ps1` command:

- uses the globally pre-provisioned stable x64 MSVC Rust toolchain;
- validates the locked Tauri CLI and canonical NSIS cache;
- packages only against an isolated temporary copy of the NSIS cache;
- restores the caller's complete environment-variable set and working directory in `finally`;
- leaves only intended build outputs and project-local npm dependencies.

## Release tag identity

When a release tag is supplied, checkout must use `refs/tags/<tag>`. Before building, the workflow resolves checked-out `HEAD` and the peeled tag commit and requires exact equality. An unqualified branch/tag name is not acceptable for release attachment.

## Publisher validation

Before any write-enabled upload, the isolated hosted publisher must:

- accept exactly four recursive entries and no directories or nested extras;
- require every expected asset to be a regular non-symlink file;
- require exactly one checksum entry for each of the three binary assets;
- reject malformed, duplicate, missing and unexpected checksum targets;
- run `sha256sum --check --strict`;
- invoke `gh release upload` once with the complete allowlisted path set.

The publisher continues to avoid checkout and execution of repository code.

## Enforcement

Permanent contract tests cover the policy value, ordinal fingerprint algorithm, local shell hygiene, exact tag identity and publisher structure. Temporary audit workflow 0027 additionally executed a real Windows installer build and hosted-Linux positive/negative publisher fixtures, then was removed before merge.
