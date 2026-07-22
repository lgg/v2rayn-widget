# UI Reference

## Style direction

- compact floating utility card;
- rounded translucent surfaces;
- dark/light themes;
- minimal native chrome;
- all interactive controls remain keyboard reachable.

## Main widget

Top:
- labelled client selector;
- direct Happ Setup action when Happ is selected;
- optional labelled profile selector;
- Settings button.

Center:
- status chip announced as live status;
- connect/toggle button disabled while an action or `Connecting` state is active;
- capability explanation when control is unavailable.

Bottom:
- optional status/clock/IP/latency panel;
- optional action row (`refresh`, `open`, `copy`, diagnostics);
- transient notices announced as status or alert.

Bootstrap failure replaces the loading state with an explicit error and Retry action.

## Settings window

- internal scroll area and persistent save footer;
- native-close requests use the same unsaved-draft confirmation as the visible close button;
- live visual settings are serialized and reconciled with authoritative backend state on failure;
- draft-only application/network/path settings save atomically;
- v2rayN auto/manual path inputs form one keyboard radio group;
- load and save failures remain visible instead of closing the window.

## Happ Setup window

- automatic or explicit executable path;
- probe runs against the unsaved candidate currently displayed;
- experimental control cannot be enabled without a successful candidate probe;
- process/window/action/transport diagnostics are redacted;
- native and visible close actions protect an unsaved draft;
- stale configured paths do not prevent discovery, while operational commands remain fail-closed to the configured installation.

## Debug Tools window

- explicit initial-probe loading and failure states;
- failed probes clear stale successful results;
- controls are disabled while an operation is active;
- runtime log and redacted probe details scroll independently;
- minimum window dimensions preserve a usable two-column layout.

## Shared behavior

- window draggable only on non-interactive regions;
- close hides to tray instead of exiting;
- asynchronous Tauri listener registration is safely disposed after unmount;
- document language metadata follows EN/RU switching;
- hidden clock UI does not retain a background one-second timer;
- all user-facing frontend strings use locale JSON keys.
