# 0013 - Multi-Client Adapter Architecture

## Status

Accepted and implemented.

## Context

The application began with reusable Tauri/React UI but commands, settings and labels were directly coupled to v2rayN. Happ and future clients require different status/control sources and may support different combinations of profiles, servers, transport modes and subscriptions.

A rename or one-off conditional implementation would spread client-specific branching through the frontend and backend.

## Decision

Use a compile-time adapter registry with explicit client descriptors, capabilities, diagnostics and operational methods.

The shared application layer owns:

- persisted selected client;
- generic command contracts;
- selected-adapter dispatch;
- external connectivity/IP/latency diagnostics;
- capability gating;
- shared Tauri windows, tray, settings and frontend UX.

Each adapter owns:

- application detection;
- executable/config path validation;
- client-specific status signals;
- application open/restart/reload behavior;
- connect/disconnect implementation;
- profile/server enumeration and selection;
- transport-mode interpretation;
- adapter-specific errors and diagnostics.

`ProxyClientAdapter` must own descriptor, refresh, toggle, list/select item, open and diagnostics operations. The generic command dispatcher must not branch by client.

## Compatibility Strategy

- Default selected client is v2rayN.
- Existing persisted settings load through Serde defaults.
- Legacy Tauri commands remain during staged migration.
- Existing `tun_enabled` and `active_profile_name` fields remain compatibility aliases.
- New adapters must not depend on compatibility fields.

## Capability Strategy

The adapter descriptor is the source of truth for supported actions.

Capability states:

- supported;
- experimental;
- unsupported;
- research required.

Unsupported actions are protected twice:

1. hidden or disabled in frontend;
2. rejected explicitly in backend.

Subscription capabilities are separate from profile/server capabilities.

v2rayN subscription list/switch/refresh/add/remove/manage remain unsupported. Profile switching does not imply subscription switching.

## Happ Strategy

### Safe baseline

The Happ adapter must start conservative:

- detect process/PID and executable;
- open the application;
- expose generic network diagnostics;
- never report Connected from process existence alone;
- never mutate undocumented config, database or subscription files.

### Control-source priority

1. official documented CLI/API;
2. stable documented or safely validated daemon IPC;
3. read-only config/database inspection;
4. Windows UI Automation/tray automation;
5. direct mutation only after a separate security/reliability decision.

### Implemented control decision

No stable documented public CLI/API/daemon IPC contract was selected for production control. Direct internal mutation is rejected.

Windows UI Automation is permitted only as an explicitly experimental, disabled-by-default fallback when all safeguards apply:

- user gives persisted explicit consent;
- search is scoped to the detected Happ PID;
- only exact explicit Connect/Disconnect labels are accepted;
- generic Connection, Auto connect, Reconnect, settings and extended labels are rejected;
- a high confidence threshold is required;
- no action occurs on ambiguity;
- adapter diagnostics expose the detected window/action/confidence/UI tree;
- the feature remains marked experimental and version-sensitive.

Server/profile and subscription operations remain unavailable until a safer stable contract exists.

## Alternatives Considered

### Separate Happ fork/application

Rejected because it duplicates UI, settings, packaging and diagnostics and makes every future adapter expensive.

### Conditional branches inside generic commands

Rejected. Client-specific dispatch belongs in the adapter implementation/registry.

### Fully dynamic plugin loading

Deferred. Runtime DLL/plugin loading adds versioning, security and packaging complexity. Compile-time adapters are sufficient.

### Immediate removal of legacy commands

Rejected because it combines architecture migration with behavior changes.

### Happ internal config/database mutation

Rejected due to compatibility, corruption and security risks.

### Unrestricted UI text matching

Rejected. Substring matching could click unrelated Connection or Connect-to-server controls. Only exact recognized action names are accepted.

## Consequences

Positive:

- future clients can be added behind a stable operational boundary;
- generic commands remain client-agnostic;
- UI accurately represents partial implementations;
- v2rayN behavior migrates without breaking compatibility;
- Happ gets safe baseline behavior and diagnosable experimental control;
- subscription limitations remain explicit.

Negative:

- compatibility fields and wrappers temporarily increase code size;
- some v2rayN services remain legacy-shaped;
- Happ UI Automation is version-sensitive;
- users must validate the installed Happ UI through the setup probe before enabling experimental control.

## Follow-Up

- Complete task 0011 before strengthening claims around v2rayN subscription-driven profile switching.
- Build subscription support as a separate abstraction/task.
- Add future clients through the operational adapter contract without changing the generic dispatcher.
- Remove compatibility commands/fields only in a separate reviewed cleanup.
