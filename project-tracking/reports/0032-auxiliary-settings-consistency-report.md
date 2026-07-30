# 0032 - Auxiliary Settings Consistency Audit Report

## Status

Implementation in progress.

## Audit method

The audit rechecked Main, Settings, Happ Setup, Debug Tools and Diagnostics from rendered controls through settings ownership, asynchronous persistence, Tauri events and backend commands. It specifically compared the documented application-wide language/visual settings with the initialization and update behavior of every native React webview.

## Confirmed defects

1. **Happ Setup appearance/language drift.** The window fetched settings only to populate Happ fields; it never applied persisted theme/language/opacity/effect values and did not subscribe to settings updates.
2. **Debug Tools appearance/language drift.** The screen did not fetch application settings at all and remained on browser-language/default DOM styling.
3. **Non-linearizable Settings save.** Live UI patches were serialized with each other, but the full save bypassed that queue. A slower older patch could therefore persist after the full save and roll back one field.

## Corrections implemented

- added a shared auxiliary-surface settings applicator for language, theme, opacity and visual effects;
- applied it during Happ Setup and Debug Tools initialization;
- subscribed both auxiliary surfaces to settings-updated events;
- preserved Happ Setup local path/consent input while a draft is dirty;
- synchronized clean Happ Setup input to authoritative external changes;
- queued the full Settings save behind prior live patches;
- blocked new live-patch submission after the full save starts;
- added regression coverage for persisted/live auxiliary settings and save ordering.

## Screen and capability audit

No capability state was promoted or broadened. Main remains selected-adapter/capability gated; Settings remains the owner of general and v2rayN fields; Happ Setup remains the owner of Happ path and explicit consent; Debug Tools remains v2rayN-specific; Diagnostics remains an external webview without default Tauri IPC capability.

## Verification status

Pending exact-head Release Quality.
