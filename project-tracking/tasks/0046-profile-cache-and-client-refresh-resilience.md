# 0046 - Profile cache and client refresh resilience

Status: Done
Priority: P1

## Problem

A fresh audit of `main` at `5142879249fb462cf21fafb562bf82e091d373ab` after tasks 0043-0045 found three remaining state-resilience gaps:

1. The v2rayN last-successful profile cache was keyed by one stored path at a time. Visiting installation A, then B, discarded A's verified catalog, so a transient read failure after returning to A could no longer recover A's own last successful catalog.
2. `list_items` returned successful `[]` when the v2rayN installation path could not be resolved. Since successful empty catalogs are intentionally authoritative, a temporary path-resolution failure could erase a previously verified frontend catalog instead of being treated as a command failure.
3. Main optimistically changes `settings.selected_client` before the backend `select_client` command finishes. The previous App-level settings-state effect reacted to that optimistic transition and could dispatch a second refresh against the old backend client context, causing an expected `CLIENT_CONTEXT_CHANGED` cancellation to surface as a false refresh failure or needlessly duplicating the selected client's startup refresh.

## Scope completed

- Replaced the single-entry v2rayN profile cache with an in-memory cache keyed by resolved installation path.
- Preserved successful empty catalogs independently per installation path.
- Made unresolved v2rayN profile paths return a command error rather than a successful empty catalog.
- Preserved frontend catalog behavior: command failures retain the last verified catalog, while genuine successful `[]` results remain authoritative.
- Removed operational refresh ownership from arbitrary local settings-state transitions.
- Operational refreshes are now triggered from authoritative `settings-updated` events by comparing the current store refresh key with the incoming backend settings before applying the event.
- A locally optimistic client selection therefore does not trigger a duplicate refresh when the backend event confirms the same selected client, while a genuinely external selected-client or same-client operational settings event still refreshes.
- Kept v2rayN path/mock changes, Happ path/control changes and health-display probe settings refreshable.
- Added focused Rust and frontend regression coverage for per-installation cache isolation, unresolved-path failure semantics, optimistic selection confirmation, external client transitions, same-client operational changes and initial settings hydration.
- Re-verified native ordering: settings are saved/applied and client context is invalidated before `settings-updated` is emitted, so event-driven refresh observes authoritative backend state.

## Acceptance criteria

- A successful catalog for installation A survives successful reads from installation B and remains available for a later transient A read failure.
- A successful empty catalog for A replaces only A's cached catalog and does not alter B's cache.
- Missing/unresolved v2rayN installation path is an error, not an authoritative empty catalog.
- Explicit Main client selection owns its startup refresh and its confirming authoritative settings event does not trigger a second refresh.
- A genuinely external authoritative selected-client change still triggers an operational refresh.
- Same-client authoritative operational settings changes still trigger an operational refresh.
- The first settings event does not duplicate the dashboard-store-owned startup hydration.
- Frontend install/audit/tests/build pass.
- Rust formatting/tests/strict Clippy/build pass.
- Portable Windows release smoke artifact is produced.

## Repository/branch audit

- Product/default branch is `main`; this repository has no `master` branch.
- Open PRs at audit start: 0.
- Open issues at audit start: 0.
- Branches at audit start: `main` plus intentional archival `beads-backup`.
- `beads-backup` remains historical `.beads/backup/*` export data, not unmerged product code, and must not be merged into `main`.

## Files

- `src/tauri/src/adapters/v2rayn.rs`
- `src/frontend/src/app/App.tsx`
- `src/frontend/src/app/App.operational-refresh.test.tsx`
- `project-tracking/tasks/0046-profile-cache-and-client-refresh-resilience.md`
- `project-tracking/reports/0046-profile-cache-and-client-refresh-resilience-audit.md`

## Validation history

- Release Quality #545 (`31528979735`) on candidate head `41e79d077cdfe5a1409cc0ec588e5278270f33d0` was **rejected**. Frontend validation passed, but Rust validation exposed two defects in the new regression code: one rustfmt drift and `assert_eq!` comparisons on `ProfileSummary`, which intentionally has no `PartialEq`. The test was rewritten to validate cached length/id/name without changing the production model.
- Release Quality #548 (`31530231226`) on corrected head `e398ea3e565147769ca7471651ed7e2070e05de8` was also **rejected**. Frontend, Rust tests, both Clippy configurations, locked build and portable package passed, but the aggregate gate correctly retained failure because one remaining multiline assertion still differed from exact rustfmt output. `cargo test --locked` at this point already passed 130 unit tests plus 1 app-action, 9 product-surface and 1 quality-storage contract tests. The remaining change was formatting-only and did not alter behavior.
- Release Quality #549 (`31531414988`) on exact implementation head `e5088465fed0d607d9f31af14a678c5b80e263f2` completed **successfully**. Frontend: dependency audit found 0 vulnerabilities; 33 test files / 122 tests passed; `tsc -b` and Vite production build passed. Rust: rustfmt passed; 130 unit tests plus 1 app-action, 9 product-surface and 1 quality-storage contract tests passed; debug and release Clippy passed with warnings denied; locked Rust check/build passed; portable Windows release smoke artifact upload passed. The uploaded portable artifact ZIP final size was 6,717,693 bytes with SHA-256 `e3dc074f039930df5feb5b34ae1d19921796b096009188e115fe611c12e0bd86`.
- Release Quality #551 (`31532789010`) on closing documentation head `4f29465aec76a53088c1bc96b4c57473a31abf70` completed **successfully** before merge. Frontend and Rust jobs both passed all gates, including tests, formatting, both Clippy configurations, locked build, portable Windows release smoke build/upload and aggregate validation.

## Merge evidence

- PR #45, `0046: harden profile cache and client refresh ownership`, merged into `main` on 2026-08-11 at 20:42:48Z.
- Verified PR head before merge: `4f29465aec76a53088c1bc96b4c57473a31abf70`.
- Merge commit: `d0a52eaa9ec71fd4e8aeb8c572327d0ea5e9562f`.
- The final post-merge evidence update is documentation-only and is validated separately before it is merged into `main`.
