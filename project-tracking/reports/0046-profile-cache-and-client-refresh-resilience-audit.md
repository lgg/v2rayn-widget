# 0046 - Profile cache and client refresh resilience audit

Date: 2026-08-11
Baseline: `main` at `5142879249fb462cf21fafb562bf82e091d373ab`
Status: Implementation complete / validation pending

## Repository state reviewed

- Default/product branch: `main`; there is no `master` branch.
- Open pull requests at audit start: none.
- Open issues at audit start: none.
- Branch inventory at audit start: `main` and `beads-backup` only.
- `beads-backup` was re-checked against `main`: its unique history consists of old `bd backup export-git` commits whose unique files are `.beads/backup/*`. It is archival tracking data, not an unmerged product branch.

## Audit coverage

The fresh pass reviewed the latest merged audit/fix chain and the high-risk state boundaries around it:

- Main dashboard bootstrap, foreground/background refresh, delayed post-route refresh, client selection and profile selection;
- frontend command-error normalization, status freshness and operational-client context ownership;
- v2rayN path resolution, profile reads, fallback cache semantics, UI/restart control boundaries and installation scoping;
- Happ process detection, explicit UI Automation consent, probe/toggle/open behavior and executable scoping;
- Settings/Happ Setup asynchronous operation ownership and draft-safe close behavior;
- native application exit/relaunch draft-surface guard;
- Release Quality self-hosted runner gating, dependency audit, frontend/Rust quality gates and portable packaging;
- release-assets exact-ref/version checks, dependency/install restrictions, NSIS cache immutability and publish permission separation;
- repository TODO and error-to-empty patterns relevant to the recent catalog fixes.

## Confirmed finding 1 - Single-entry path cache lost a previously verified installation

The v2rayN adapter's cache stored one `base_path` plus one catalog. A successful read from installation B therefore replaced the cached catalog from installation A. Returning to A and hitting a transient config-read failure had no matching fallback, even though A had been verified earlier in the same application process.

### Resolution

- Cache storage is now a map keyed by resolved installation path.
- Successful reads update only their own path entry.
- Successful empty catalogs remain valid cached results for that exact path.
- A later read failure uses only the cache for the exact current path and cannot borrow another installation's catalog.
- Regression coverage verifies A/B coexistence and path-local successful-empty replacement.

## Confirmed finding 2 - Unresolved path was mislabeled as a successful empty catalog

`list_items` returned `Ok(Vec::new())` when `resolve_v2rayn_base_path` returned `None`. That result is semantically different from a successful config read containing zero profiles. After the catalog correctness fixes in tasks 0044-0045, frontend code correctly treats successful `[]` as authoritative, so a temporary missing/unavailable installation path could erase a previously verified selector catalog.

### Resolution

- Missing/unresolved v2rayN installation path now returns an explicit command error.
- Frontend catalog hydration already distinguishes command failure (`null` internally) from genuine successful `[]`, so the verified catalog is preserved on path-resolution failure without weakening successful-empty semantics.
- A Rust regression locks the error-vs-empty contract.

## Confirmed finding 3 - Optimistic client selection could dispatch a duplicate stale-context refresh

Main updates `settings.selected_client` optimistically before the backend `select_client` command completes. The previous App-level settings-state effect reacted to that optimistic change before backend selection ownership had transferred, so it could launch a second refresh against the old adapter context. The backend correctly rejected stale work by client epoch, but that redundant request could still surface an expected `CLIENT_CONTEXT_CHANGED` as a false refresh failure or duplicate the explicit startup refresh.

### Resolution

- Removed operational refresh ownership from arbitrary local settings-state transitions.
- The `settings-updated` listener now compares the current dashboard-store operational refresh key with the incoming authoritative backend settings before applying the event.
- If the event merely confirms the client already selected optimistically in Main, the keys match and no second refresh is dispatched.
- If an authoritative event truly changes the selected client externally, or changes same-client path/control/health settings, the keys differ and a refresh still runs after the authoritative settings are applied.
- The first settings event remains owned by dashboard-store startup hydration and does not receive a duplicate App refresh.
- Focused App regressions cover optimistic confirmation, external selected-client change, same-client operational change and first-event hydration.

### PR self-review hardening

The first implementation attempted to suppress refresh for every selected-client transition. A review of the existing external-settings contract showed that this was too broad because authoritative external client changes also relied on the refresh path. That implementation was corrected on the PR branch before merge; the final approach distinguishes optimistic local state from authoritative backend events instead of treating all client transitions alike.

## Additional audit results

No additional confirmed defect was found in the inspected current surfaces after these fixes:

- status freshness parsing keeps RFC3339 sub-millisecond ordering and rejects malformed candidate timestamps when a current valid timestamp exists;
- delayed route/profile refreshes retain client-generation ownership and no longer collapse catalog command failures into successful empty catalogs;
- native Exit/Admin Relaunch checks visible Settings and Happ Setup draft surfaces, routes them through their safe-close events and fails closed if a draft surface remains visible;
- Happ Setup retains synchronous operation ownership and deferred native close behavior;
- Release Quality runs same-repository, non-draft PR code only on the self-hosted runner, uses read-only repository permissions and checkout without persisted credentials;
- frontend dependency install in quality/release workflows uses `npm ci --ignore-scripts` and a locked tree;
- release packaging verifies the checked-out tag/version relationship, uses the pre-provisioned immutable NSIS cache, and grants `contents: write` only to the separate release-attachment job;
- repository search found no current TODO marker requiring implementation in the audited product surface.

## Validation history

Release Quality #545 (`31528979735`) on candidate head `41e79d077cdfe5a1409cc0ec588e5278270f33d0` was rejected rather than waived. The frontend job was green, including locked install, dependency audit, 33 frontend test files / 122 tests and production build. The Rust job's aggregate failure correctly exposed two defects in the newly added test code:

1. `cargo fmt --all -- --check` rejected one line in `v2rayn.rs` that did not match rustfmt output.
2. `cargo test --locked` failed to compile three `assert_eq!` comparisons because `ProfileSummary` intentionally has no `PartialEq` implementation.

The workflow continued into later gates because constituent Rust steps are diagnostic/continue-on-error before the aggregate failure step; therefore the later successful Clippy/build/portable steps do not make #545 a green validation run. The branch was corrected before merge by applying rustfmt output and rewriting the cache regression to inspect profile count/id/name instead of deriving a new production trait solely for testing.

A fresh full Release Quality run on the corrected exact head is required before merge. The exact successful run, verified head and final merge commit will be appended only after those checks complete successfully.

## Honest validation boundary

This audit validates repository state, implementation semantics, focused regressions, static contracts, compilation and Windows package production once CI completes. It does not claim a fresh manual end-to-end matrix against every real v2rayN/Happ version, every installation layout, every privilege combination or every WebView2/UI Automation timing.
