# 0027 - Final Release Integrity Follow-up

## Status

In progress.

## Context

PR #14 completed the post-UAC validation-only hardening, but its final tracking state was not written back after merge. A continuation audit of the merged implementation also found remaining gaps in local installer execution, complete NSIS cache pinning, exact release-tag checkout and publisher-side artifact verification.

## Confirmed defects

1. `scripts/build-installer.ps1` invoked `rust-env.ps1` without `-UseGlobalHomes`, so a normal developer machine with globally provisioned Rust could fail against empty repository-local Rust homes.
2. The local installer script did not restore the caller's location or the Visual Studio/Rust environment imported during the build.
3. The policy pinned only the Tauri NSIS plugin hash; a modified `makensis.exe` or another cache file could pass version/required-file checks because the complete fingerprint was compared only with its own copy.
4. Release checkout used an unqualified tag name, allowing a branch/tag name collision to make manual release attachment ambiguous.
5. The publisher counted only top-level files, so nested extra artifact content was not rejected by the documented exact allowlist.
6. The publisher ran `sha256sum --check` but did not prove that the manifest contained exactly one checksum for every distributable binary.
7. Task/report 0026 still claimed the final quality gate and merge were pending.

## Requirements

- Pin the audited SHA-256 fingerprint of the complete Tauri NSIS cache.
- Reject any source or isolated cache whose full fingerprint differs from policy.
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

- [x] Complete audited NSIS cache fingerprint added to policy.
- [x] Prerequisite validation rejects any non-approved full cache fingerprint.
- [x] Local installer uses global Rust and restores caller state.
- [x] Release tags are qualified and commit identity is verified.
- [x] Publisher rejects nested extras, symlinks and incomplete/duplicate checksum manifests.
- [x] Contracts cover all new release and local-build guarantees.
- [x] Task 0026 status is corrected.
- [ ] Real installer audit passes on the final implementation.
- [ ] Final exact-head Release Quality passes.
- [ ] PR is squash-merged into `main`.
