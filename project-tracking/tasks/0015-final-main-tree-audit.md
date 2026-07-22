# 0015 - Final Main-Tree Audit and Release Hardening

## Metadata

| Field | Value |
| --- | --- |
| Status | Done |
| Priority | P1 |
| Type | audit / hardening |
| Created | 2026-07-21 |
| Completed | 2026-07-22 |
| Labels | audit, adapters, happ, v2rayn, tauri, frontend, security, ci |
| Public redaction | Passed |

## Context

PR #2 was squash-merged into `main` as `2339ba21cf09ac10fd108f4cfe59874c3f521183`. This task independently audited that exact merged tree and did not rely only on the previous branch review.

## Goal

Verify that the current merged implementation is internally consistent, secure, reproducible and accurately documented; fix every reproducible defect found; merge the verified corrections back into `main` through a separate pull request.

## Confirmed Findings and Fixes

- live settings controls now submit field-level patches instead of stale full-window payloads;
- settings loading and persistence failures now leave the UI recoverable and visible to the user;
- stale frontend status, profile and client operations are rejected after operational-context changes;
- profile selection no longer displays an arbitrary first item when the active profile is unknown;
- settings and v2rayN config writes are serialized and use temporary files plus backups;
- config, log, process and privilege discovery were tightened around the selected installation;
- public network diagnostics reject local/reserved destinations, disable ambient proxies and redirects, pin validated DNS results and bound response bodies;
- Windows build environment discovery now supports installed Build Tools and Visual Studio editions through `vswhere` plus safe fallbacks;
- CI now checks all Rust formatting and produces both portable and NSIS smoke artifacts;
- the initial NSIS smoke command inherited an incorrect duplicated `src/src/frontend` path; the installer-only config now reuses the canonical frontend build command from the main Tauri configuration.

## Acceptance Criteria

- [x] Exact current `main` tree audited as a complete repository.
- [x] Every reproducible defect found in this pass is fixed in this PR.
- [x] Frontend install, dependency audit, tests and production build pass.
- [x] Rust formatting, tests, strict Clippy and locked check pass.
- [x] Locked Windows release build produces the expected portable executable.
- [x] Locked Tauri build produces the expected NSIS installer.
- [x] PR contains no temporary audit payloads, private endpoints or real local paths.
- [x] Documentation reflects verified behavior and residual risks.
- [x] PR #3 is squash-merged into `main` only after the final head is green.

## Verification

The permanent `Release Quality` workflow validates:

1. clean frontend dependency installation from the lockfile;
2. high-severity dependency audit;
3. frontend tests and production build;
4. full Rust formatting check;
5. locked Rust tests, strict Clippy and `cargo check`;
6. locked portable Windows release build and executable artifact;
7. clean frontend reinstall for packaging;
8. locked Tauri NSIS build and installer artifact.

## Residual Runtime Risks

- Happ UI Automation remains version-sensitive, opt-in and fail-closed because no stable official automation API has been verified.
- Windows UI Automation can differ across privilege levels, sessions and installed client versions.
- Automated builds cannot replace interactive checks against every v2rayN or Happ release.

## Links

- Previous hardening PR: `#2`
- Final audit PR: `#3`
