# 0023 - Refresh After Diagnostic Endpoint Changes

## Metadata

| Field | Value |
| --- | --- |
| Status | In progress |
| Priority | P1 |
| Type | full-project audit follow-up / frontend reliability |
| Baseline | `70b238b86f6842bef33b6860e7aa8adb4c107b3e` |

## Context

A new independent audit of the current `main` tree found that full settings saves update `connectivity_endpoints` and `ip_endpoints`, but the main widget's immediate operational refresh dependencies do not include those arrays. The next periodic refresh can therefore keep status data produced through the previous diagnostic endpoints for as long as the configured polling interval.

## Goal

Refresh the selected client immediately when diagnostic endpoint content changes, without adding redundant refreshes for unrelated visual settings or during initial bootstrap.

## In scope

- track persisted connectivity and external-IP endpoint content in the main widget process;
- trigger one selected-client refresh after endpoint content changes;
- avoid refresh on initial settings load, null/recovery transitions and unrelated settings changes;
- add deterministic frontend regression coverage;
- verify the complete permanent quality gate.

## Out of scope

- changing endpoint normalization or network target validation;
- changing backend command contracts;
- changing polling cadence or diagnostic algorithms;
- adding new clients or subscription operations.

## Affected areas

- `src/frontend/src/main.tsx`;
- `src/frontend/src/features/diagnostic-endpoint-refresh.ts`;
- frontend regression tests;
- project tracking report.

## Acceptance criteria

- [x] Initial settings bootstrap does not schedule a duplicate refresh.
- [x] Unrelated settings changes do not schedule a refresh.
- [x] Connectivity endpoint content changes schedule a refresh.
- [x] External-IP endpoint content changes schedule a refresh.
- [x] Returning from a null settings state establishes a new baseline without an unnecessary refresh.
- [ ] Frontend tests and production build pass.
- [ ] Rust formatting, tests, strict Clippy variants and locked check pass.
- [ ] Portable and NSIS smoke builds pass.
- [ ] PR is squash-merged into `main`.

## Verification plan

1. Run the endpoint tracker regression tests.
2. Run the complete frontend test suite and production build.
3. Run the permanent Windows/Rust quality workflow on the exact PR head.
4. Review the final diff for unrelated changes and public-data leakage.

## Risks

- A store subscription could recursively react to status updates. The tracker compares only settings endpoint content, so refresh-driven status writes do not retrigger it.
- A full settings reload could appear as a change due only to new array identities. The tracker uses serialized endpoint values rather than reference identity.

## Related files

- `project-tracking/reports/0023-refresh-after-diagnostic-endpoint-changes-report.md`
