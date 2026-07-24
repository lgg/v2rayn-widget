# 0027 - Final Release Integrity Follow-up

## Status

Implementation and dedicated runtime audit complete; final permanent exact-head quality gate pending.

## Context

PR #14 completed the post-UAC validation-only hardening, but its final tracking state was not written back after merge. A continuation audit of the merged implementation also found remaining gaps in local installer execution, complete NSIS cache pinning, exact release-tag checkout and publisher-side artifact verification.

## Confirmed defects

1. `scripts/build-installer.ps1` invoked `rust-env.ps1` without `-UseGlobalHomes`, so a normal developer machine with globally provisioned Rust could fail against empty repository-local Rust homes.
2. The local installer script did not restore the caller's location or the Visual Studio/Rust environment imported during the build.
3. The policy pinned only the Tauri NSIS plugin hash; a modified `makensis.exe` or another cache file could pass version/required-file checks because the complete fingerprint was compared only with its own copy.
4. The complete-cache manifest used culture-dependent `Sort-Object FullName`, so an otherwise identical cache could produce different fingerprints across locales.
5. Release checkout used an unqualified tag name, allowing a branch/tag name collision to make manual release attachment ambiguous.
6. The publisher counted only top-level files, so nested extra artifact content was not rejected by the documented exact allowlist.
7. The publisher ran `sha256sum --check` but did not prove that the manifest contained exactly one checksum for every distributable binary.
8. Task/report 0026 still claimed the final quality gate and merge were pending.

## Requirements

- Pin the canonical ordinal SHA-256 fingerprint of the complete Tauri NSIS cache.
- Reject any source or isolated cache whose full fingerprint differs from policy.
- Make fingerprint generation locale-independent through normalized relative paths and ordinal sorting.
- Use the globally pre-provisioned Rust toolchain in the local installer command.
- Restore the complete caller environment and working directory after local packaging, including failure paths.
- Qualify release tags as `refs/tags/<tag>` and verify checked-out HEAD matches the peeled tag commit.
- Enforce an exact recursive release artifact allowlist and reject symlinks.
- Require a strict checksum manifest with exactly one unique entry for each binary.
- Preserve the isolated hosted publisher boundary and single write permission.
- Add permanent contracts for every new invariant.
- Execute a real installer build and final exact-head quality gate before merge.
- Finalize task/report 0026 with the already completed run and merge evidence.

## Acceptance criteria

- [x] Canonical complete NSIS cache fingerprint added to policy.
- [x] Fingerprint algorithm uses normalized paths and `StringComparer.Ordinal`.
- [x] Prerequisite validation rejects any non-approved full cache fingerprint.
- [x] Local installer uses global Rust and restores complete caller state.
- [x] Release tags are qualified and commit identity is verified.
- [x] Publisher rejects nested extras, symlinks and incomplete/duplicate checksum manifests.
- [x] Contracts cover all new release and local-build guarantees.
- [x] Task/report 0026 status is corrected.
- [x] Audit 0027 Installer Integrity run #7 (`30072641292`) passed both the real Windows installer build and hosted-Linux publisher fixtures on SHA `cf06ebd1f2c39f4e63d32d31f8f1d58ffdd0e2ac`.
- [x] Temporary audit workflow was removed after successful verification.
- [ ] Final exact-head Release Quality passes on the clean permanent workflow set.
- [ ] PR is squash-merged into `main`.
