# 0013 - Multi-Client Adapter Architecture

## Status

Accepted for staged implementation.

## Context

The application currently exposes a reusable Tauri/React widget but directly couples commands, settings and frontend labels to v2rayN. Happ and future clients require different status and control sources. Some clients may support profiles, servers, transport modes or subscriptions, while others may not.

A simple rename or one-off conditional implementation would spread client-specific branching across the frontend and backend and would make future integrations harder to validate.

## Decision

Introduce a backend adapter registry with explicit client descriptors and capabilities.

The shared application layer owns:

- persisted selected client;
- generic status and action contracts;
- external connectivity/IP/latency diagnostics;
- adapter selection/dispatch;
- capability gating;
- shared Tauri window, tray, settings and frontend UX.

Each adapter owns:

- application detection;
- executable/config path validation;
- process/status signals specific to the client;
- application open/restart/reload behavior;
- connect/disconnect implementation;
- profile/server enumeration and selection;
- transport-mode interpretation;
- adapter-specific errors and diagnostics.

## Compatibility Strategy

- Default selected client is v2rayN.
- Existing persisted settings load through serde defaults.
- Legacy Tauri commands remain as wrappers during migration.
- Existing fields such as `tun_enabled` and `active_profile_name` may remain as compatibility aliases until frontend migration is complete.
- New adapters must not depend on those compatibility fields.

## Capability Strategy

The adapter descriptor is the source of truth for supported actions.

The frontend must not infer capabilities from client name.

Unsupported actions are handled twice:

1. hidden or disabled in the frontend;
2. rejected explicitly in the backend.

Subscription capabilities are separate from profile/server capabilities.

At decision time, v2rayN subscription list/switch/refresh/add/remove are all unsupported. Profile switching does not imply subscription switching.

## Happ Strategy

The Happ adapter starts read-only and conservative.

Integration source priority:

1. official CLI/API;
2. stable documented or safely validated daemon IPC;
3. read-only config/database inspection;
4. UI Automation/tray automation;
5. direct config mutation only after an explicit separate security/reliability decision.

A running Happ process must not be reported as Connected without an additional reliable connection-state signal.

## Alternatives Considered

### Separate fork/application for Happ

Rejected as the default architecture because it would duplicate UI, settings, packaging and diagnostics and would make future adapters equally expensive.

### Conditional branches inside existing commands

Rejected as the long-term design because app-specific logic would continue spreading through commands and frontend code.

### Fully dynamic plugin loading

Deferred. Runtime DLL/plugin loading adds versioning, security and packaging complexity that is not required for the first adapters. Compile-time adapters behind a registry are sufficient.

### Remove all legacy commands immediately

Rejected because it would combine architecture migration and behavior changes into one high-risk step.

## Consequences

Positive:

- future clients can be added behind a stable boundary;
- UI can accurately represent partial implementations;
- v2rayN behavior can be migrated incrementally;
- Happ research can proceed without unsafe claims or mutations;
- subscription limitations become explicit.

Negative:

- temporary compatibility fields and wrappers increase short-term code size;
- some v2rayN services remain legacy-shaped during extraction;
- adapter capabilities and shared status require additional tests and documentation;
- full Happ control remains blocked on research.

## Follow-Up

- Implement task 0013.
- Complete task 0011 before strengthening claims around v2rayN subscription-driven profile switching.
- Create a dedicated Happ IPC/control research report before implementing undocumented control paths.
