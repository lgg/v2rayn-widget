# 0045 - Preserve profile catalog on command failure audit

Date: 2026-08-05
Baseline: `main` at `b24075eb29f518a79c4d46f5e1e9dd997f5f7f28`
Status: Verified / merge-ready

## Repository state reviewed

- Default/product branch: `main`; the repository has no `master` branch.
- Open pull requests at audit start: none.
- Open issues at audit start: none.
- Product branches at audit start: only `main`.
- `beads-backup` remains an intentional tracking archive, not a product branch.

## Confirmed finding 1 - command failure erased a verified catalog

The dashboard store used `listSelectedClientItems().catch(() => [])` in every catalog refresh path. This made a rejected Tauri command indistinguishable from an authoritative successful empty catalog.

Consequences:

- a transient IPC or command-level failure could erase a previously verified selector catalog;
- the UI could display no profiles even though the active client and its last known catalog remained valid;
- task 0044's correct successful-empty behavior made preserving failures especially important, because `[]` now intentionally clears state.

Resolution:

- introduced a nullable internal catalog result;
- `ProfileSummary[]` remains authoritative, including a successful empty array;
- `null` represents list-command failure and preserves the previous catalog;
- applied the distinction consistently across bootstrap, refresh, client selection, delayed toggle refresh, immediate/delayed item selection and initial external-settings hydration;
- retained existing status freshness and client-generation checks;
- added regressions for manual refresh, delayed toggle refresh and immediate/delayed item refresh failures;
- retained task 0044 regressions proving successful empty catalogs still clear stale entries.

## Confirmed finding 2 - current npm audit exposed patched dependency advisories

A fresh full validation cycle on 2026-08-11 reached the current npm advisory database and found:

- NanoID `3.3.16`: high-severity advisory `GHSA-2v37-7h3g-55p8`, patched in `3.3.17`;
- PostCSS `8.5.21`: moderate advisory `GHSA-fxqj-rqcc-2cmp`, patched in `8.5.23`.

The existing `package.json` range `postcss ^8.4.49` already permits the patched PostCSS release, and NanoID is transitive, so no manifest widening or unrelated dependency update is required.

Resolution:

- locked NanoID at `3.3.17`;
- locked PostCSS at `8.5.23`;
- kept all unrelated package records unchanged relative to the pristine lockfile;
- restored repository LF line endings after the Windows checkout so the lockfile does not contain a whole-file CRLF diff.

## Confirmed finding 3 - product-surface contract asserted an obsolete implementation shape

Release Quality #534 proved the production implementation, dependency audit, Clippy checks, Rust build and portable package could all succeed, but the Rust aggregate gate still failed because `product_surface_contracts.rs` asserted the old literal source shape `profiles: accept ? profiles : previous.profiles`.

That source-string contract became obsolete when finding 1 introduced `applyCatalogResult`; the failure did not represent a broken product invariant, but leaving the assertion unchanged would keep valid refactors permanently red in CI.

Resolution:

- kept production code unchanged;
- updated the contract to assert the actual invariant instead: the freshness gate remains present, accepted catalogs flow through `applyCatalogResult`, and `catalog === null` preserves the previous catalog while a successful `[]` remains authoritative;
- reran the complete Windows Release Quality workflow and confirmed the corrected product-surface contract passes.

## CI and lockfile recovery evidence

Release Quality run #521 (`30965283250`) initially completed the frontend job successfully but its first Rust job ended during the Rust-test step without retrievable job logs. A later single-job retry could not be used as validation because it failed before Rust verification at `Download frontend distribution`: the older frontend artifact was no longer available. Neither event is treated as a product-code failure or as successful Rust validation.

Release Quality run #522 (`31514764850`) was a fresh full cycle. Its frontend dependency restore, all 118 frontend tests and production build passed, but the aggregate frontend gate correctly failed because the current npm audit detected the NanoID high advisory and PostCSS moderate advisory described above.

An initial manual lockfile security edit was rejected before merge: Release Quality #523 (`31516656123`) failed `npm ci` with `EINTEGRITY`, and GitHub compare showed unrelated integrity/metadata drift. The branch was restored to the exact pristine package-lock blob `1983819be03a0007f09e2305bca9eac008ec28c1` before retrying the security patch.

The final security lock patch was then produced fail-closed from that pristine blob:

- every one of the six old NanoID/PostCSS version/resolved/integrity strings had to occur exactly once;
- the resulting JSON had to report NanoID `3.3.17` and PostCSS `8.5.23`;
- the write was bound to the exact expected pristine blob SHA so concurrent or unrelated lock changes would be rejected;
- Windows CRLF introduced by checkout was normalized back to the repository's LF representation;
- the temporary patch/export workflow was removed from the branch after use.

Release Quality run #534 (`31519141176`) then passed frontend install/audit/tests/build, Rust formatting, the 129 Rust unit tests, debug/release Clippy, Rust build and portable release smoke build/upload. Its final Rust aggregate gate correctly exposed finding 3: one stale product-surface source assertion failed even though the product and packaging checks themselves succeeded.

Release Quality run #535 (`31520683711`) on implementation head `d548ac30ba19af5948d44c8b63bd1697075aef54` completed successfully end-to-end:

- frontend dependency restore passed;
- `npm audit --audit-level=high` reported `0 vulnerabilities`;
- all 32 frontend test files / 118 tests passed;
- frontend production build and artifact upload passed;
- Rust formatting passed;
- 129 Rust unit tests passed;
- app-action contract: 1/1 passed;
- product-surface contracts: 9/9 passed;
- quality-storage contract: 1/1 passed;
- strict debug Clippy passed;
- strict release Clippy passed;
- Rust build passed;
- portable Windows release smoke build and upload passed;
- portable artifact size: 6,715,649 bytes;
- portable artifact SHA-256 digest: `19f410919ad2c8243d0c63eae59bd502aa6eb8e97441fe3d32a54d57f80acb28`.

The closing task/report commit changes documentation only; it must retain a green Release Quality check before PR merge.

## Review observations

- No Tauri command or shared type contract changed.
- No subscription or unsupported capability was introduced.
- Client switch still clears old-client profiles before loading the new context; a list failure therefore preserves the correct new-context empty state rather than restoring the old client's catalog.
- The production behavior change remains frontend-only and minimally scoped; the additional lockfile change is a targeted security maintenance fix discovered by the mandatory quality gate.
- No dependency manifest range was widened.
- Public diff review found no secrets, local paths, private endpoints or user configuration data.

## Changed files

- `src/frontend/src/features/dashboard-store.ts`
- `src/frontend/src/features/dashboard-store-catalog-failure.test.ts`
- `src/frontend/package-lock.json`
- `src/tauri/tests/product_surface_contracts.rs`
- `project-tracking/tasks/0045-preserve-profile-catalog-on-command-failure.md`
- `project-tracking/reports/0045-preserve-profile-catalog-on-command-failure-audit.md`

## Validation boundary

Automated regressions prove the covered state transitions for successful empty results and rejected list commands, and the Windows quality workflow proves the committed dependency/build/package graph used by CI. This does not claim fresh manual end-to-end validation against every real v2rayN/Happ version, installation layout or transient WebView2/IPC condition.
