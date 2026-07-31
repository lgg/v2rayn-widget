# 0035 - Final Declared Surface Audit

## Metadata

| Field | Value |
| --- | --- |
| Status | In Progress |
| Priority | P1 |
| Type | audit/hardening |
| Base | `9edc190b875275f392121272b335831b6b5d75f7` |
| Public redaction | Reviewed |

## Context

Tasks 0030-0034 hardened active-client context, native window/tray consistency and asynchronous result ownership. This independent pass verifies the current Windows product against every declared screen, action, capability, IPC boundary, quality workflow and tracked limitation.

## Goal

Make the current declared Windows product internally consistent, accessible, warning-free and honestly documented without claiming unsupported subscriptions, unvalidated external installations or cross-platform support.

## Confirmed findings in scope

1. Settings can close while a live UI write is still pending, hiding a later persistence/recovery failure; failed recovery can also leave the optimistic value visible.
2. v2rayN-specific Debug Tools remain actionable while Happ is selected, producing technical backend context errors instead of an explicit unsupported state.
3. Main can announce the same status twice and the connection button exposes only a generic Toggle accessible name.
4. Permanent workflows pin Node 20 generations of official checkout/artifact actions while the runner has moved to Node 24.
5. README and roadmap/related-work sections stop before recent completed audits; external-only tasks 0011/0012 are not classified clearly enough.

## Scope

- Harden Settings live-write close/recovery ownership.
- Gate v2rayN Debug Tools by selected adapter and expose an explicit localized state.
- Remove duplicate live-region status announcements and provide state-specific connection action names.
- Upgrade official Actions to immutable Node 24 revisions and update contracts.
- Synchronize README, architecture, roadmap, task 0011 and task/decision/report 0012.
- Add focused frontend/contract regressions.
- Run complete Release Quality and portable release smoke build.

## Out of scope

- Claiming subscription support.
- Completing task 0011 without representative real subscription-driven installations.
- Implementing Linux/macOS support.
- Claiming stable official Happ control.

## Acceptance criteria

- [ ] Settings waits for pending live writes before close and stays visible on unresolved persistence failure.
- [ ] Failed live-write recovery restores the last authoritative live UI fields without discarding unrelated draft-only fields.
- [ ] Debug Tools performs no v2rayN command while Happ is selected and enables itself after an authoritative switch to v2rayN.
- [ ] Exactly one status live region is exposed on Main and the connection button has a state-specific accessible name.
- [ ] Permanent workflows use full-SHA Node 24 official actions and workflow contracts validate them.
- [ ] README/architecture/roadmaps accurately cover tasks 0030-0035 and distinguish current release scope from external/deferred work.
- [ ] Task 0011 is honestly blocked/deferred on external manual QA; task 0012 has an explicit defer decision.
- [ ] Complete exact-head Release Quality is green with no React act warnings and a portable executable artifact.
- [ ] Implementation and final evidence are merged into `main`.

## Verification plan

- Frontend unit/component tests for queue idle waiting, Settings close/failure recovery, Debug adapter gating and accessibility.
- Workflow contract tests for immutable Node 24 action SHAs.
- TypeScript/Vite production build.
- Full Rust tests, rustfmt, both Clippy modes, locked check and portable release smoke build.
- Documentation and public-redaction review.

## Risks

- A close wait must not deadlock when a live write rejects.
- Authoritative rollback must preserve unrelated unsaved draft-only fields.
- Debug gating must react to later settings events without duplicate probes.
- Workflow upgrades must remain compatible with the self-hosted runner and artifact handoff.
