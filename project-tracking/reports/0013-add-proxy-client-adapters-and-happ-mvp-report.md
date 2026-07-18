# 0013 - Proxy Client Adapters and Happ MVP Report

## Summary

A first multi-client architecture slice was implemented in `feature/proxy-client-adapters` and opened as draft pull request #1.

The change preserves the existing v2rayN implementation behind a compatibility adapter, adds generic selected-client commands and frontend state, introduces a real `ProxyClientAdapter` registration trait, and starts a conservative read-only Happ adapter.

The pull request remains draft because automated workflow execution and real Windows validation are still pending.

## Implemented

### Planning and decisions

- Added the detailed multi-client roadmap.
- Added task 0013 with scope, acceptance criteria and verification plan.
- Added the multi-client architecture decision.
- Updated the main roadmap.
- Updated README and architecture documentation.

### Shared adapter models

- Added `ProxyClientId` with `v2rayn` and `happ`.
- Added migration-safe v2rayN default.
- Added `CapabilityState`:
  - supported;
  - experimental;
  - unsupported;
  - research required.
- Added `ClientCapabilities` and `ClientDescriptor`.
- Added `ProxyClientAdapter` registration trait.
- Added a registry containing v2rayN and Happ.

### Settings migration

- Added persisted `selected_client`.
- Added optional persisted `happ_path`.
- Existing settings without the new fields default to v2rayN and no Happ path.
- Added a settings deserialization test.

### Generic backend API

Added selected-client commands for:

- client catalog;
- current descriptor;
- client selection;
- normal/background/startup/post-route refresh;
- connection toggle;
- item list;
- item selection;
- application open.

Tray refresh/open actions now use the selected-client path.

Legacy v2rayN commands remain registered.

### v2rayN adapter

The adapter delegates to the current proven implementation, preserving:

- path detection;
- config/log/profile reading;
- process monitoring;
- status resolution;
- Enable TUN UI Automation;
- config plus reload/restart fallback;
- profile enumeration;
- experimental profile selection;
- open/restart behavior;
- privilege diagnostics.

The following capabilities are explicitly `unsupported`:

- generic transport-mode reporting;
- subscription listing;
- subscription switching;
- subscription refresh/update;
- subscription add/remove/manage.

Profile selection is documented as distinct from subscription switching.

### Happ read-only adapter

Implemented:

- known process-name detection;
- executable path from a running process;
- common Windows installation path probing;
- optional persisted path consumption;
- application launch;
- generic external IP and latency probes;
- explicit `Unknown` status while Happ runs without a validated internal signal;
- explicit `Disconnected` status while the process is absent;
- backend errors for unavailable control actions.

Not implemented:

- reliable Happ connection state;
- connect/disconnect;
- transport mode;
- server/profile enumeration and selection;
- subscriptions;
- daemon IPC;
- settings-window path editor.

No Happ config/database mutation was added.

### Frontend

- Added client catalog to Zustand state.
- Added v2rayN/Happ selector.
- Persisted client switching through backend command.
- Clears stale status and profile/server items when switching.
- Routes refresh/toggle/open/item actions through generic commands.
- Hides profile/server selector when unsupported.
- Disables connection action when unsupported.
- Shows adapter status note for the Happ read-only MVP.
- Added EN/RU generic labels.
- Added a client-selector component test.

### CI

Added `.github/workflows/windows-quality.yml` with:

- frontend dependency installation;
- frontend tests;
- frontend production build;
- Rust formatting check;
- Rust tests;
- Rust build check.

## Verification Status

### Completed by review

- Architecture/documentation consistency review.
- Public redaction review.
- Pull request diff review for accidental removal of current v2rayN behavior.
- Capability review ensuring v2rayN subscriptions are not claimed as supported.
- Conservative Happ status review ensuring process existence does not imply Connected.

### Pending

- GitHub Actions workflow execution: no workflow run or commit status was created for the PR commits at report time.
- Local build: the execution container could not resolve `github.com`, so a local clone/build could not be performed.
- Rust tests and compile check.
- Frontend tests/type check/build.
- Real Windows v2rayN regression validation.
- Real Windows Happ detection/open validation.
- Manual client-switch UX validation.

Because these checks are pending, the PR remains draft and the task remains In Progress.

## Known Follow-Up Work

1. Obtain a successful Windows quality run and fix any compile/test failures.
2. Validate v2rayN TUN toggle, fallback, profile list and experimental selection on the existing machine.
3. Validate Happ process/executable names against the installed Happ version.
4. Add a settings UI for manual Happ executable path.
5. Research official Happ CLI/API before daemon IPC or UI Automation.
6. Add a separate generic status model with transport mode and active item before removing v2rayN compatibility fields.
7. Extract more of the legacy v2rayN orchestration from `commands/mod.rs` into adapter-owned services after regression validation.
8. Model subscriptions separately from profiles/servers.

## Security and Public Data Review

The change does not include:

- tokens or credentials;
- real subscription URLs;
- private proxy endpoints;
- real local installation paths;
- real configs or logs;
- personal data.

Happ integration does not write to undocumented config/database files.

## Result

The repository now has a concrete extensible foundation rather than a one-off Happ fork. The current v2rayN behavior is preserved through the compatibility adapter, while Happ is available as a selectable read-only adapter with accurate capability restrictions.

The implementation is intentionally not marked complete or merge-ready until automated and real Windows checks pass.
