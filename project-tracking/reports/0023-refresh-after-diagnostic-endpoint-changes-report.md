# 0023 Full Project Audit Report

## Baseline

The audit started from exact `main` commit `70b238b86f6842bef33b6860e7aa8adb4c107b3e` after the previous full-project verification.

The review covered the declared product surface, frontend state transitions, Tauri command boundaries, adapter capability reporting, settings persistence, external v2rayN config mutation, process/privilege handling, health-check network safety, window/capability isolation, release workflows and existing verification coverage.

## Confirmed finding 1: diagnostic endpoint changes did not refresh status

The settings window persists `connectivity_endpoints` and `ip_endpoints` through a full settings update and emits `settings-updated`. The main widget applies the new settings, but its previous immediate operational refresh dependencies did not include endpoint content.

Existing external IP and latency could therefore remain derived from the old endpoint configuration until a later periodic or manual refresh. At the maximum supported polling interval, stale diagnostic data could remain visible for up to one hour.

### Correction

Added a main-surface-only Zustand subscription that tracks serialized endpoint values:

- initial settings establish a baseline and do not duplicate bootstrap refresh;
- unrelated settings updates with new object/array identities do not refresh;
- changed connectivity or external-IP endpoint content schedules one selected-client refresh;
- refresh-driven status writes do not retrigger the watcher;
- a null settings state resets the baseline safely;
- Settings, Debug Tools and Happ Setup windows do not create duplicate subscriptions.

## Confirmed finding 2: profile fallback could invent an unknown config field

Project architecture and safety documentation state that external v2rayN config updates are schema-preserving and fail closed. The legacy profile writer, however, inserted a new root `IndexId` whenever no known string ID selector existed.

That behavior could mutate an unknown v2rayN schema, create a field that the installed version does not consume, and then restart v2rayN under a false assumption that profile selection was applied.

### Correction

Production config access now routes through a fail-closed wrapper:

- known existing string ID selectors are updated in place;
- optional existing name selectors are updated only after an ID selector is confirmed;
- profile collection records are excluded from selector traversal;
- missing, name-only, wrongly typed and profile-record-only selectors are rejected;
- rejection occurs before any write or backup creation;
- primary-config validation, backup-preserving replacement and byte-for-byte concurrent-change rejection remain in effect;
- TUN and profile writes share the production wrapper's serialization lock.

The old implementation remains a private compatibility module for its established read/TUN helpers; production callers resolve through the safe public module.

## Other audited areas

No additional correctness defect was confirmed in the reviewed areas:

- adapter registry and capability maturity accurately distinguish supported, experimental and unsupported operations;
- stale async client results are rejected by selected-client epoch checks;
- TUN config fallback refuses unknown/non-boolean fields and concurrent external mutations;
- health-check endpoints reject private/reserved addresses, disable redirects and ambient proxies, pin validated DNS results and bound external-IP response bodies;
- the diagnostics external WebView is not included in the Tauri capability allowlist;
- settings/config files use validated reads and backup-preserving replacement;
- release publication verifies versions, exact expected asset names and SHA-256 checksums before upload.

## Files changed

- `src/frontend/src/main.tsx`;
- `src/frontend/src/features/diagnostic-endpoint-refresh.ts`;
- `src/frontend/src/features/diagnostic-endpoint-refresh.test.ts`;
- `src/tauri/src/services/mod.rs`;
- `src/tauri/src/services/config_reader_safe.rs`;
- task and report documents for 0023.

## Verification

Pending the permanent PR quality workflow on the final PR revision:

- workflow contract checks;
- frontend dependency audit;
- frontend tests and production build;
- Rust formatting and tests;
- default/all-target strict Clippy;
- release/no-default-features strict Clippy;
- locked Rust check;
- portable Windows release smoke build;
- NSIS installer smoke build.

## Public-data review

The diff contains no credentials, private endpoints, local user paths, subscription data, runtime logs or personal information. Test endpoints and fixture data are neutral examples.

## Residual limitations

- v2rayN profile switching remains explicitly experimental because UI automation and external config layout can vary by v2rayN version.
- Unknown selector schemas now fail closed and require a deliberate compatibility update rather than best-effort field invention.
- Live compatibility with every released v2rayN/Happ build cannot be proven by repository-only automated tests; the project exposes diagnostics and keeps unsupported capability claims explicit.
