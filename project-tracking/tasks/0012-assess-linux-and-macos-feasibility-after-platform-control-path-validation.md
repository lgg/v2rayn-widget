# 0012 - Assess Linux and macOS Feasibility After Platform Control Path Validation

## Metadata

| Field | Value |
| --- | --- |
| Status | Open |
| Priority | P3 |
| Type | decision |
| Source | Beads `v2rayn-4r5` |
| Created | 2026-05-28T07:24:04Z |
| Labels | cross-platform, roadmap |
| Public redaction | Required before commit/update |

## Context

The current app is a Windows-first Tauri widget that depends on platform-specific v2rayN control paths, process behavior, logs/config locations and UI automation. Linux/macOS support should not start until those platform-specific control paths are validated on real systems.

## Goal

Decide whether Linux/macOS support is feasible and worth implementing.

## Scope

Included:

- Identify platform-specific v2rayN control path for Linux and macOS.
- Document limitations.
- Decide whether to proceed, defer or reject cross-platform support.
- Create follow-up tasks if proceeding.

Out of scope:

- Implementing Linux/macOS support before feasibility is accepted.
- Publishing local system paths, private configs, proxy endpoints or logs from test machines.

## Affected Areas

- Rust/Tauri backend: Platform-specific process/config/log/control services.
- React/TypeScript frontend: UI may need platform capability states if proceeding.
- Shared types/API contracts: Status/control capability model may be needed.
- Tests: Platform-specific validation plan.
- Documentation: Feasibility decision and roadmap.
- Build/release scripts: Cross-platform build scripts only if proceeding.
- Config/examples: Platform docs only if proceeding.
- Project tracking: Decision/report/follow-up tasks required.

## Acceptance Criteria

- [ ] A feasibility decision documents platform control path.
- [ ] Decision documents limitations and risks.
- [ ] Decision states whether to proceed, defer or reject Linux/macOS support.
- [ ] Follow-up tasks exist if support proceeds.
- [ ] No local system paths, private configs, real logs, endpoints or personal data are committed.
- [ ] Public task/report materials do not contain secrets, private URLs, local system paths or personal data.

## Verification Plan

- [ ] Manual QA/research: Validate control paths on real Linux/macOS systems or document why not possible.
- [ ] Documentation review: Decision is clear and actionable.
- [ ] Public redaction review: Confirm no private machine data is included.

## Questions and Answers

| Question | Status | Answer / Decision |
| --- | --- | --- |
| Which Linux/macOS v2rayN-compatible control paths are available? | Open | Requires real-system validation or reliable project documentation. |
| Should UI expose unsupported platform states? | Open | Decide only after feasibility outcome. |

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Cross-platform work creates unreliable partial support | High | Require feasibility decision before implementation. |
| Local machine details leak into docs | High | Use generic paths/placeholders and redaction review. |

## Links

- Roadmap: `project-tracking/roadmap/0000-roadmap.md`
- Related decisions: Create decision file when assessment is complete.
- Source tracker: Beads `v2rayn-4r5`
