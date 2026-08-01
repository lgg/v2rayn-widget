# 0035 - Final Declared Surface Audit

## Metadata

| Field | Value |
| --- | --- |
| Status | Done |
| Priority | P1 |
| Type | audit/hardening |
| Base | `9edc190b875275f392121272b335831b6b5d75f7` |
| Verified head | `830d11a9964ce144d2451498ccf4b5cd574a9252` |
| Merge commit | `535c4aad466bd2ffb527feaf3123d09b810eeb41` |
| Public redaction | Reviewed |

## Context

Tasks 0030-0034 hardened active-client context, native window/tray consistency and asynchronous result ownership. This independent pass verified the current Windows product against every declared screen, action, capability, IPC boundary, quality workflow and tracked limitation.

## Goal

Make the current declared Windows product internally consistent, accessible, warning-free and honestly documented without claiming unsupported subscriptions, unvalidated external installations or cross-platform support.

## Confirmed findings in scope

1. Settings could close while a live UI write was still pending, hiding a later persistence/recovery failure; failed recovery could also leave the optimistic value visible.
2. v2rayN-specific Debug Tools remained actionable while Happ was selected, producing technical backend context errors instead of an explicit unsupported state.
3. Main could announce the same status twice and the connection button exposed only a generic Toggle accessible name.
4. Permanent workflows pinned Node 20 generations of official checkout/artifact actions while the runner had moved to Node 24.
5. README and roadmap/related-work sections stopped before recent completed audits; external-only tasks 0011/0012 were not classified clearly enough.

## Scope completed

- Hardened Settings live-write close/recovery ownership.
- Gated v2rayN Debug Tools by selected adapter and exposed an explicit localized state.
- Removed duplicate live-region status announcements and added state-specific connection action names.
- Upgraded official Actions to immutable Node 24 revisions and updated workflow contracts.
- Synchronized README, architecture, roadmap, task 0011 and task/decision/report 0012.
- Added focused frontend and workflow-contract regressions.
- Ran complete Release Quality and portable release smoke build.

## Out of scope

- Claiming subscription support.
- Completing task 0011 without representative real subscription-driven installations.
- Implementing Linux/macOS support.
- Claiming stable official Happ control.

## Acceptance criteria

- [x] Settings waits for pending live writes before close and stays visible on unresolved persistence failure.
- [x] Failed live-write recovery restores the last authoritative live UI fields without discarding unrelated draft-only fields.
- [x] Debug Tools performs no v2rayN command while Happ is selected and enables itself after an authoritative switch to v2rayN.
- [x] Exactly one status live region is exposed on Main and the connection button has a state-specific accessible name.
- [x] Permanent workflows use full-SHA Node 24 official actions and workflow contracts validate them.
- [x] README/architecture/roadmaps accurately cover tasks 0030-0035 and distinguish current release scope from external/deferred work.
- [x] Task 0011 is honestly blocked on external manual QA; task 0012 has an explicit defer decision.
- [x] Complete exact-head Release Quality is green with no React act warnings and a portable executable artifact.
- [x] Implementation and final evidence are merged into `main`.

## Verification evidence

- Release Quality run `#483` completed successfully on exact head `830d11a9964ce144d2451498ccf4b5cd574a9252`.
- Frontend job passed workflow contracts, dependency audit, 92 tests and the TypeScript/Vite production build.
- Rust Windows job passed rustfmt, Rust tests, strict Clippy for normal and release configurations, locked build checks and portable release artifact generation.
- Pull request `#31` was squash-merged into `main` as `535c4aad466bd2ffb527feaf3123d09b810eeb41`.

## Residual limitations

Task 0011 remains blocked because it requires representative real subscription-driven v2rayN installations. Subscription operations remain explicitly unsupported. Linux/macOS support remains deferred by decision 0012. Happ control remains explicitly experimental and opt-in.
