# 0045 - Preserve profile catalog on command failure

Status: In Progress
Priority: P1

## Context

Task 0044 correctly made a successful empty profile catalog authoritative, so deleted profiles disappear from the selector. A fresh audit found that the frontend still mapped every `list_selected_client_items` command rejection to `[]`.

That conflated two different outcomes:

- successful empty catalog: replace the previous catalog with `[]`;
- command/IPC failure: no authoritative catalog was received, so preserve the last verified catalog.

The v2rayN adapter already owns fallback for configuration-read failures, but a rejection can also occur at the Tauri/IPC or command boundary. Those failures must not erase valid selector state.

## Goal

Keep the last verified profile/item catalog when listing fails while continuing to apply successful empty catalogs.

## Scope

- Represent a failed item-list command separately from a successful empty array.
- Preserve the previous catalog on command failure in bootstrap, refresh, client switch, route refresh, item switch and initial external-settings hydration flows.
- Keep status freshness and client-generation ownership checks unchanged.
- Add focused regressions for manual refresh and delayed toggle/item refreshes.
- Retain the existing successful-empty regressions from task 0044.

## Out of scope

- Subscription listing or switching.
- Changes to the adapter command API.
- Changes to v2rayN configuration-read caching.
- New proxy-client capabilities.

## Affected files

- `src/frontend/src/features/dashboard-store.ts`
- `src/frontend/src/features/dashboard-store-catalog-failure.test.ts`
- `src/frontend/src/features/dashboard-store-empty-catalog.test.ts` (existing complementary coverage)
- `project-tracking/reports/0045-preserve-profile-catalog-on-command-failure-audit.md`

## Acceptance criteria

- A successful `[]` result clears stale profiles.
- A rejected list command preserves the previous verified catalog.
- A fresh status can still be applied when catalog listing fails.
- Manual/background, client-selection, delayed toggle and item-selection paths use the same distinction.
- Existing stale-context/freshness protections remain intact.
- Frontend tests/build and the full Windows Release Quality workflow pass.

## Validation plan

- Run focused Vitest regressions for successful empty and command-failure outcomes.
- Run the complete frontend test suite and production build.
- Run Rust formatting, tests, strict debug/release Clippy, build and portable release smoke through the repository workflow.
- Review the public diff for accidental sensitive data.

## Risks

- Accidentally treating `null` as a real catalog would clear or corrupt UI state; a single helper centralizes the distinction.
- Client-switch flows intentionally start with an empty catalog for the new context; command failure must not restore another client's profiles.

## Related work

- Task/report 0043: command error boundary and profile read resilience.
- Task/report 0044: successful empty profile catalogs and guarded destructive actions.
