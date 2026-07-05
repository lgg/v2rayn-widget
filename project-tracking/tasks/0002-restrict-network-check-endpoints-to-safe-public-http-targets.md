# 0002 - Restrict Network Check Endpoints to Safe Public HTTP(S) Targets

## Metadata

| Field | Value |
| --- | --- |
| Status | Closed |
| Priority | P1 |
| Type | bug |
| Source | Beads `v2rayn-odi` |
| Created | 2026-05-28T07:23:56Z |
| Closed | 2026-05-28T07:42:47Z |
| Labels | audit, next, security |
| Public redaction | Completed |

## Context

Endpoint normalization allowed arbitrary HTTP(S) hosts. For a public desktop app, diagnostics and latency/IP checks must not be usable to target local, private, link-local, metadata or otherwise unsafe network addresses.

## Goal

Restrict custom latency/IP endpoints to safe public HTTP(S) targets.

## Scope

Included:

- Reject loopback, private, link-local, metadata and local network targets.
- Keep public HTTP(S) endpoints valid.
- Cover accepted and rejected endpoint categories in tests.

Out of scope:

- Designing a trusted override for local/private targets.
- Adding built-in leak diagnostics.

## Affected Areas

- Rust/Tauri backend: Endpoint validation and health checks.
- React/TypeScript frontend: Settings validation messaging, if surfaced.
- Shared types/API contracts: Settings model only if validation shape changes.
- Tests: Accepted/rejected endpoint cases.
- Documentation: Security behavior and task/report tracking.
- Build/release scripts: Not affected.
- Config/examples: Not affected.
- Project tracking: Updated.

## Acceptance Criteria

- [x] Custom latency/IP endpoints reject local/private targets.
- [x] Tests cover accepted public hosts and rejected local targets.
- [x] Public task/report materials do not contain secrets, private URLs, local system paths or personal data.

## Verification Plan

- [x] Tests: Historical implementation verified accepted/rejected cases.
- [x] Security review: Unsafe local targets blocked.
- [x] Public redaction review: Completed during migration.

## Questions and Answers

| Question | Status | Answer / Decision |
| --- | --- | --- |
| Should local endpoints be allowed with an override? | Resolved | No override is included in this task. |

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| URL parsing edge cases bypass validation | High | Keep endpoint validation tests broad and security-focused. |

## Links

- Related reports: `project-tracking/reports/0002-restrict-network-check-endpoints-to-safe-public-http-targets-report.md`
- Source tracker: Beads `v2rayn-odi`
