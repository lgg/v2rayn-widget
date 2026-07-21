# 0014 - Post-Merge Deep Audit and Hardening Report

## Status

Complete. PR #2 independently audited the exact squash-merged result of PR #1, fixed every reproducible issue found, strengthened permanent CI and produced a verified Windows release executable.

## Audit Baseline

The audit started from exact `main` squash commit `e1a0d72e65f9c392e33fca2db8f1ad9e6bdb7641`, the merge result of PR #1. A separate branch and PR were used so post-merge findings remained independently reviewable.

## Confirmed Findings and Fixes

### Frontend state invalidation

An in-flight action could be invalidated by changing Happ operational settings while leaving `actionLoading` set. The store now clears stale action state whenever the operational client context changes, and a regression test verifies that a late result cannot restore stale status.

### Persisted settings versus event delivery

Client selection and Happ settings were saved before Tauri events were emitted, but event-delivery errors were propagated as if persistence had failed. The frontend could report a failed save while the backend retained the new value. Event delivery is now best-effort after successful persistence and is logged on failure.

### v2rayN profile selector safety

Recursive selector lookup and mutation could inspect profile arrays and confuse a profile record's `IndexId` with the active selector. The reader/writer now skips profile collections, never mutates array records while locating selectors, does not guess the first profile as active, and inserts a root ID selector when only a name selector exists. Profile confirmation requires exact normalized equality rather than substring overlap.

### Network diagnostic target safety

Configured hostnames were filtered syntactically, but a hostname could resolve to a local/reserved address, redirects were followed by default, and the HTTP client performed a second DNS lookup after validation. Requests now disable redirects and ambient proxy settings, reject an endpoint if any resolved address is non-public, and pin the request to the exact validated socket-address set. Loopback, private, link-local, CGNAT, benchmark, documentation, multicast, reserved, NAT64, Teredo and 6to4 ranges are rejected.

### Dependency and lockfile safety

The frontend dependency graph contained two high-severity advisories. Vite and the affected transitive multipart dependency were updated; the final public dependency audit reports zero vulnerabilities. During validation, regenerated lockfile entries were also found to contain non-public resolved registry URLs. All affected entries were normalized to `registry.npmjs.org`, and clean CI installation now succeeds from the public lockfile.

### Release verification and scripts

The previous workflow proved tests and compilation but did not prove that a distributable executable existed. The permanent `Release Quality` workflow now runs a locked optimized Windows build, verifies `target/release/v2rayn-widget.exe` and uploads it as a one-day smoke artifact. Portable and installer scripts use deterministic frontend installation, explicit dependency audit and locked Cargo commands.

### Product metadata

The HTML title and Rust package metadata still described the application as v2rayN-only. They now describe Proxy Client Widget while preserving the existing Tauri identifier for settings and update compatibility.

## Verified Results

- public `npm ci --no-audit --no-fund`: passed;
- `npm audit --audit-level=high`: 0 vulnerabilities;
- frontend test files: 6 passed;
- frontend tests: 19 passed;
- TypeScript/Vite production build: passed with Vite 8.1.5;
- Windows Rust formatting: passed after official rustfmt application;
- Rust unit/regression tests: 48 passed, 0 failed;
- `cargo clippy --locked --all-targets -- -D warnings`: passed;
- `cargo check --locked`: passed;
- `cargo build --release --locked`: passed;
- Windows executable `v2rayn-widget.exe`: produced and uploaded as release-smoke artifact.

## Permanent Quality Gate

The workflow intentionally separates platform-neutral frontend validation from Windows-specific desktop validation:

- Ubuntu: public dependency install, high-severity audit, frontend tests and production build;
- Windows: rustfmt, full Rust suite, strict Clippy, locked check, locked optimized build and executable artifact validation.

This avoids coupling frontend reproducibility to a runner-specific package proxy while keeping all WinAPI, Tauri and executable checks on Windows.

## Residual Runtime Risks

Happ UI Automation remains version-, session- and privilege-sensitive. It is disabled by default, requires a successful probe and explicit consent, scopes controls to the detected PID, rejects ambiguity and confirms the post-click state. Automated CI cannot replace an interactive check against every installed Happ or v2rayN version.

## Public Redaction Review

Passed. The final PR contains no credentials, subscription payloads, private endpoints, internal registry addresses, local user paths, temporary audit payloads, runtime configs, personal data or unredacted UI labels.
