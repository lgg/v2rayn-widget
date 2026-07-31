# 0034 - Async and Native Consistency Audit Report

## Status

Implementation complete; final exact-head verification pending.

## Audit method

The audit traced native tray dispatch, selected-client epochs, backend event ownership, frontend listener registration, startup bootstrap replacement, timestamp precision, auxiliary loading/save races, React test scheduling and Windows runner storage/cleanup behavior.

## Confirmed defects corrected

- tray result identity could diverge from the adapter actually dispatched;
- JavaScript millisecond parsing discarded Chrono nanosecond ordering;
- authoritative listeners had a registration gap before initial requests;
- an initial settings event could cancel bootstrap without replacement operational refresh;
- authoritative settings events could leave Settings or Happ Setup loading;
- the Unknown placeholder could appear newer than real backend status;
- a stale failed live write could show a false settings-save error;
- Release Quality could choose non-fixed storage and silently leave generated paths;
- auxiliary tests emitted React act warnings and a source contract depended on line wrapping.

## Corrections

- backend-owned tray operation envelopes capture client and epoch once;
- stale tray results/errors are suppressed instead of mislabeled;
- frontend compares full RFC3339 nanosecond instants and treats placeholder status as oldest;
- Main registers all authoritative listeners before bootstrap;
- Settings, Happ Setup and Debug register settings listeners before initial loads;
- an initial settings event starts an authoritative startup status/profile refresh;
- Settings and Happ Setup leave loading on authoritative events;
- stale live-save failures are revision-gated;
- Release Quality selects only ready fixed drives and verifies every cleanup path;
- auxiliary test renders flush listener-ready state within act;
- CI fails on React act warnings;
- source contracts validate semantic listener registration across formatter layouts.

## Verification

Pending final permanent exact-head Release Quality.
