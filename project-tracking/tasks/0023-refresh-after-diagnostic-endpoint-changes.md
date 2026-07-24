# 0023 - Full Audit Reliability and Config Safety

## Metadata

| Field | Value |
| --- | --- |
| Status | In progress |
| Priority | P1 |
| Type | full-project audit follow-up / reliability / external-config safety |
| Baseline | `70b238b86f6842bef33b6860e7aa8adb4c107b3e` |

## Context

A new independent audit of the current `main` tree found two confirmed defects:

1. Full settings saves update `connectivity_endpoints` and `ip_endpoints`, but the main widget did not immediately refresh status after those endpoint values changed. Data produced through the old endpoints could remain visible until the next periodic or manual refresh.
2. The v2rayN profile fallback was documented as schema-preserving and fail-closed, but the legacy config writer inserted a new root `IndexId` when no known string ID selector existed. This could mutate an unknown external v2rayN config schema instead of refusing the operation.

## Goal

- Refresh the selected client immediately when diagnostic endpoint content changes, without redundant refreshes during bootstrap or unrelated visual updates.
- Make production config access reject profile fallback when no recognized existing string ID selector can be updated.

## In scope

- track persisted connectivity and external-IP endpoint content in the main widget process;
- trigger one selected-client refresh after endpoint changes;
- avoid refresh on initial settings load, null/recovery transitions and unrelated changes;
- route production config access through a fail-closed wrapper;
- preserve existing known selector fields and profile records;
- reject missing, name-only, wrongly typed or profile-record-only selectors without writing a file or backup;
- preserve guarded updates and the shared application-level config-write serialization;
- add deterministic frontend and Rust regression coverage;
- verify the complete permanent quality gate.

## Out of scope

- changing endpoint normalization or network target validation;
- changing v2rayN UI automation heuristics;
- inventing support for unknown v2rayN selector schemas;
- changing polling cadence or diagnostic algorithms;
- adding new clients or subscription operations.

## Affected areas

- `src/frontend/src/main.tsx`;
- `src/frontend/src/features/diagnostic-endpoint-refresh.ts`;
- frontend regression tests;
- `src/tauri/src/services/mod.rs`;
- `src/tauri/src/services/config_reader_safe.rs`;
- Rust regression tests;
- project tracking report.

## Acceptance criteria

- [x] Initial settings bootstrap does not schedule a duplicate refresh.
- [x] Unrelated settings changes do not schedule a refresh.
- [x] Connectivity endpoint content changes schedule a refresh.
- [x] External-IP endpoint content changes schedule a refresh.
- [x] Returning from a null settings state establishes a new baseline without an unnecessary refresh.
- [x] Production profile fallback updates an existing recognized string ID selector.
- [x] Missing or name-only selectors are rejected without inventing `IndexId`.
- [x] Selector-like fields inside profile records are not treated as application selector state.
- [x] Existing profile records are not rewritten during selector updates.
- [ ] Frontend tests and production build pass on the final PR revision.
- [ ] Rust formatting, tests, strict Clippy variants and locked check pass on the final PR revision.
- [ ] Portable and NSIS smoke builds pass on the final PR revision.
- [ ] PR is squash-merged into `main`.

## Verification plan

1. Run endpoint tracker regression tests.
2. Run fail-closed profile-selector regression tests.
3. Run the complete frontend test suite and production build.
4. Run Rust formatting, all tests, strict Clippy variants and locked checks.
5. Build portable and NSIS smoke artifacts on Windows.
6. Review the final diff for unrelated changes and public-data leakage.

## Risks and mitigations

- A store subscription could recursively react to status updates. The tracker compares only settings endpoint content, so refresh-driven status writes do not retrigger it.
- A settings reload could appear changed only because arrays have new identities. The tracker compares serialized values, not references.
- v2rayN config schemas may change. The production wrapper updates only known existing string selector fields and fails closed otherwise.
- An external process may modify the config concurrently. The writer re-reads and byte-compares the primary file immediately before its backup-preserving replacement.

## Related files

- `project-tracking/reports/0023-refresh-after-diagnostic-endpoint-changes-report.md`
