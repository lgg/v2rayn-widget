# 0014 - Post-Merge Deep Audit and Hardening Report

## Status

In progress. This report is finalized only after the hardening PR passes the complete Windows quality and portable release-smoke workflow.

## Audit Baseline

The audit started from exact `main` squash commit `e1a0d72e65f9c392e33fca2db8f1ad9e6bdb7641`, the merge result of PR #1. A separate branch and PR were used so post-merge findings are independently reviewable.

## Confirmed Findings

### Frontend state invalidation

An in-flight action could be invalidated by changing Happ operational settings while leaving `actionLoading` set. The store now clears the stale spinner whenever the operational client context changes, and a regression test verifies that a late result cannot restore stale status.

### Persisted settings versus event delivery

Client selection and Happ settings were saved before Tauri events were emitted, but event delivery errors were propagated as if persistence had failed. This could make the frontend display a failed save and roll back local state while the backend retained the new value. Event delivery is now best-effort after successful persistence and is logged on failure.

### v2rayN profile selector safety

Recursive selector lookup and mutation could inspect profile arrays and confuse a profile record's `IndexId` with the active selector. The reader/writer now skips profile collections, never mutates array records while locating selectors, does not guess the first profile as active, and inserts a root ID selector when only a name selector exists. Profile application confirmation now requires exact normalized equality rather than substring overlap.

### Network diagnostic target safety

Configured hostnames were filtered syntactically, but a hostname could resolve to a local/reserved address and redirects were followed by default. Requests now disable redirects and verify every literal or DNS-resolved address before connecting. Loopback, private, link-local, CGNAT, benchmark, documentation, multicast and reserved ranges are rejected.

### Dependency and release verification

The frontend lockfile contained two high-severity advisories. Vite and the affected transitive multipart dependency were updated with no remaining audit findings. CI now runs `npm audit --audit-level=high` and performs a locked release build that must produce `v2rayn-widget.exe`. Portable and installer scripts use reproducible frontend installation and locked Cargo commands.

### Product metadata

The HTML title and Rust package metadata still described the application as v2rayN-only and attributed the package to a tooling name. They now describe Proxy Client Widget and the repository owner while preserving the existing Tauri identifier for settings/update compatibility.

## Local Verification

- `npm audit --audit-level=high`: 0 vulnerabilities;
- frontend test files: 6 passed;
- frontend tests: 19 passed;
- TypeScript/Vite production build: passed with Vite 8.1.5.

## Pending Windows Verification

- Rust formatting;
- Rust unit/regression suite;
- strict Clippy with warnings denied;
- `cargo check --locked`;
- `cargo build --release --locked`;
- produced portable executable smoke artifact.

## Residual Runtime Risks

Happ UI Automation remains version-, session- and privilege-sensitive. It is disabled by default, requires a successful probe and explicit consent, scopes controls to the detected PID, rejects ambiguity and confirms the post-click state. Automated CI cannot replace an interactive check against every installed Happ version.

## Public Redaction Review

No credentials, subscription payloads, private endpoints, local user paths, runtime configs, personal data or unredacted UI labels are included in the changes or this report.
