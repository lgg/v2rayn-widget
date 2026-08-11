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

Main updates `settings.selected_client` optimistically before the backend `select_client` command completes. The App-level operational refresh effect previously refreshed whenever its composite settings key changed. That means the optimistic client transition could launch a second refresh while the backend still owned the old adapter context. The backend correctly protects this with client epochs, but the redundant request could still become an expected `CLIENT_CONTEXT_CHANGED` cancellation visible as a false refresh failure or simply duplicate the explicit startup refresh performed by the client-selection action.

### Resolution

- Added a settings-transition helper that distinguishes explicit selected-client transitions from same-client operational changes.
- A selected-client transition no longer starts an App-level duplicate refresh; the existing `selectClient` action owns the selected client's startup refresh.
- Same-client v2rayN/Happ operational changes and health-display probe changes still trigger refresh.
- Added helper-level and App rerender regressions for both sides of the contract.

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

## Validation plan

Before merge, Release Quality must pass on the exact PR head, including:

- workflow/installer contracts;
- `npm ci` and dependency audit;
- all frontend tests including the new operational-refresh regressions;
- frontend production build;
- Rust formatting and tests;
- debug and release Clippy with warnings denied;
- locked Rust build/check;
- portable Windows release smoke build and artifact upload.

The exact workflow run, verified head and final merge commit will be appended only after those checks complete successfully.

## Honest validation boundary

This audit validates repository state, implementation semantics, focused regressions, static contracts, compilation and Windows package production once CI completes. It does not claim a fresh manual end-to-end matrix against every real v2rayN/Happ version, every installation layout, every privilege combination or every WebView2/UI Automation timing.
