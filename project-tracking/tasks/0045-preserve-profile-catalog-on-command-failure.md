# 0045 - Preserve profile catalog on command failure

Status: Done
Priority: P1

## Context

Task 0044 correctly made a successful empty profile catalog authoritative, so deleted profiles disappear from the selector. A fresh audit found that the frontend still mapped every `list_selected_client_items` command rejection to `[]`.

That conflated two different outcomes:

- successful empty catalog: replace the previous catalog with `[]`;
- command/IPC failure: no authoritative catalog was received, so preserve the last verified catalog.

The v2rayN adapter already owns fallback for configuration-read failures, but a rejection can also occur at the Tauri/IPC or command boundary. Those failures must not erase valid selector state.

During validation, the current npm advisory database also exposed a high-severity NanoID advisory and a moderate PostCSS advisory in the locked frontend dependency graph. Because the quality workflow treats high advisories as merge blockers, task 0045 also includes the minimal compatible lockfile security patch required to restore a clean quality gate.

The final validation cycle also exposed an obsolete Rust product-surface source assertion that still described the pre-refactor catalog assignment. The assertion was updated to protect the semantic invariant instead of the old implementation shape.

## Goal

Keep the last verified profile/item catalog when listing fails while continuing to apply successful empty catalogs, and leave the validated frontend dependency graph without the newly detected NanoID/PostCSS advisories.

## Scope

- Represent a failed item-list command separately from a successful empty array.
- Preserve the previous catalog on command failure in bootstrap, refresh, client switch, route refresh, item switch and initial external-settings hydration flows.
- Keep status freshness and client-generation ownership checks unchanged.
- Add focused regressions for manual refresh and delayed toggle/item refreshes.
- Retain the existing successful-empty regressions from task 0044.
- Patch locked NanoID from `3.3.16` to `3.3.17`.
- Patch locked PostCSS from `8.5.21` to `8.5.23` without widening the existing `package.json` range or changing unrelated packages.
- Align the Rust product-surface contract with the catalog-preservation semantic invariant.

## Out of scope

- Subscription listing or switching.
- Changes to the adapter command API.
- Changes to v2rayN configuration-read caching.
- New proxy-client capabilities.
- Broad dependency upgrades unrelated to the detected advisories.

## Affected files

- `src/frontend/src/features/dashboard-store.ts`
- `src/frontend/src/features/dashboard-store-catalog-failure.test.ts`
- `src/frontend/src/features/dashboard-store-empty-catalog.test.ts` (existing complementary coverage)
- `src/frontend/package-lock.json`
- `src/tauri/tests/product_surface_contracts.rs`
- `project-tracking/reports/0045-preserve-profile-catalog-on-command-failure-audit.md`

## Acceptance criteria

- [x] A successful `[]` result clears stale profiles.
- [x] A rejected list command preserves the previous verified catalog.
- [x] A fresh status can still be applied when catalog listing fails.
- [x] Manual/background, client-selection, delayed toggle and item-selection paths use the same distinction.
- [x] Existing stale-context/freshness protections remain intact.
- [x] The lockfile changes only the intended NanoID/PostCSS package records relative to the pristine lock.
- [x] `npm ci` succeeds from the committed lockfile.
- [x] `npm audit --audit-level=high` passes with 0 vulnerabilities.
- [x] All 118 frontend tests and the production build pass.
- [x] Rust formatting, 129 unit tests, 11 contract tests, strict debug/release Clippy and Rust build pass.
- [x] Portable Windows release smoke build/upload passes.
- [x] The stale product-surface assertion is replaced with semantic catalog-preservation checks.
- [x] The closing documentation head retained a fully green Release Quality gate before merge.
- [x] PR #43 merged into `main`.

## Validation evidence

Release Quality #535 (`31520683711`) passed end-to-end on implementation head `d548ac30ba19af5948d44c8b63bd1697075aef54`:

- frontend: 32 test files / 118 tests passed;
- dependency audit: 0 vulnerabilities;
- Rust: 129 unit tests + 1 app-action + 9 product-surface + 1 quality-storage contract passed;
- debug and release Clippy passed;
- Rust build passed;
- portable release smoke artifact built/uploaded successfully;
- portable artifact SHA-256: `19f410919ad2c8243d0c63eae59bd502aa6eb8e97441fe3d32a54d57f80acb28`.

Release Quality #537 (`31522349164`) then passed end-to-end on closing documentation head `a1b9e405388b578d076e22b42d661ccd11011236`. Both `frontend` and `rust-windows` jobs completed successfully, including dependency audit, frontend tests/build, Rust formatting/tests, debug/release Clippy, Rust build, portable release build and artifact upload.

PR #43 merged into `main` as `ff291a5bd507672100c6849905484c2ac5123c36` on 2026-08-11.

## Validation plan

- Run focused Vitest regressions for successful empty and command-failure outcomes. Done.
- Run the complete frontend test suite and production build. Done.
- Verify the security lock diff against the pristine lock and ensure no unrelated package metadata changed. Done.
- Run the frontend dependency audit. Done.
- Run Rust formatting, tests, strict debug/release Clippy, build and portable release smoke through the repository workflow. Done.
- Review the public diff for accidental sensitive data. Done.
- Verify the closing documentation-only head through the same Release Quality workflow before merge. Done.

## Risks

- Accidentally treating `null` as a real catalog would clear or corrupt UI state; a single helper centralizes the distinction.
- Client-switch flows intentionally start with an empty catalog for the new context; command failure must not restore another client's profiles.
- Hand-editing a large lockfile can corrupt unrelated integrity metadata; validation therefore restored the pristine blob and applied fail-closed exact replacements only to the two affected package records.
- Source-string contracts can become stale after safe refactors; the corrected contract now asserts the semantic catalog-preservation invariant instead of the old assignment expression.

## Related work

- Task/report 0043: command error boundary and profile read resilience.
- Task/report 0044: successful empty profile catalogs and guarded destructive actions.
