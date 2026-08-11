# 0046 - Profile cache and client refresh resilience

Status: Implementation complete / validation pending
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

## Validation

Full Release Quality validation is required on the PR head before merge. This task remains validation-pending until that workflow is green and the exact run evidence is recorded here.
