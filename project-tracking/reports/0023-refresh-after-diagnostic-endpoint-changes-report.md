# 0023 Diagnostic Endpoint Refresh Audit Report

## Baseline and finding

The audit started from exact `main` commit `70b238b86f6842bef33b6860e7aa8adb4c107b3e` after the previous full-project verification.

The settings window persists `connectivity_endpoints` and `ip_endpoints` through a full settings update and emits `settings-updated`. The main widget applies the new settings, but its existing immediate operational refresh effect tracks client/path/mock/display/latency-mode changes only. Endpoint list changes therefore leave the current external IP and latency derived from the previous endpoint configuration until a later periodic or manual refresh.

At the maximum supported polling interval, stale diagnostic data could remain visible for up to one hour.

## Correction

Added a main-surface-only Zustand subscription that tracks serialized endpoint content:

- initial settings establish a baseline and do not duplicate bootstrap refresh;
- unrelated settings updates with new object/array identities do not refresh;
- changed connectivity or external-IP endpoint content schedules the selected-client refresh;
- status writes caused by refresh do not retrigger the watcher;
- a null settings state resets the baseline safely.

The watcher is installed only for the main application surface. Settings, Debug Tools and Happ Setup windows do not create duplicate subscriptions.

## Files changed

- `src/frontend/src/main.tsx`;
- `src/frontend/src/features/diagnostic-endpoint-refresh.ts`;
- `src/frontend/src/features/diagnostic-endpoint-refresh.test.ts`;
- task and report documents for 0023.

## Verification

Pending the permanent PR quality workflow on the exact final head:

- frontend dependency audit;
- frontend tests and production build;
- Rust formatting, tests, default/all-target Clippy and release/no-default-features Clippy;
- locked Rust check;
- portable Windows release smoke build;
- NSIS installer smoke build.

## Public-data review

The diff contains no credentials, private endpoints, local user paths, subscription data, runtime logs or personal information. Test endpoints are neutral public examples.

## Residual risks

The behavior remains dependent on the selected client's existing refresh implementation and network availability. Endpoint validation, DNS pinning and public-address filtering are unchanged.
