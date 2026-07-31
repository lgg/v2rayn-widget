# 0034 - Async and Native Consistency

## Status

Complete. Implementation PR #29 was squash-merged into `main` as `4276f04e085f4bccb4d0d956266a9b13cd56c873`.

## Audited baseline

`main` commit `b9f21bd2559738670d7f97bbe2a7a649ee7daec2`.

## Confirmed findings

1. Tray commands captured `selected_client` separately from backend dispatch.
2. `Date.parse` lost Rust status sub-millisecond precision.
3. Settings and tray listeners registered after initial loads began.
4. A settings event could invalidate Main bootstrap without replacement startup refresh.
5. Settings and Happ Setup could remain loading after an authoritative event.
6. Release Quality allowed non-fixed drives and silently ignored cleanup failures.
7. The default Unknown placeholder carried a current timestamp and could reject a real cached/startup status.
8. A failed stale live settings write could surface a false error after a newer authoritative settings event.
9. Auxiliary-window tests emitted React `act` warnings, while one source contract was coupled to formatter line wrapping.

## Acceptance criteria

- [x] Tray operations use one captured backend context and suppress stale outcomes.
- [x] RFC3339 nanosecond freshness is preserved and placeholder status is always older than backend status.
- [x] Listener registration precedes settings bootstrap/load on every affected surface.
- [x] Initial settings events trigger startup status/profile refresh.
- [x] Authoritative events end auxiliary loading.
- [x] Stale live-save failures do not surface after newer authoritative settings.
- [x] CI uses ready fixed drives and verifies cleanup.
- [x] React test state transitions are `act`-wrapped and `act` warnings fail CI.
- [x] Source contracts validate behavior without depending on formatter line wrapping.
- [x] Regressions cover all confirmed boundaries.
- [x] Final exact-head Release Quality passes.
- [x] PR is squash-merged and evidence recorded.

## Exact-head verification

Implementation head `0bbfc96d8dd1961f9be5d45e124e34e5522df489` passed permanent Release Quality #450, run `30632727422`.

- workflow, security and immutable-toolchain contracts: success;
- frontend dependency audit: success;
- frontend: 20 files, 84 tests passed, 0 failed;
- React `act` warning scan: clean;
- frontend production build: success;
- complete Rust formatting: success;
- Rust suites: 123 unit/integration + 9 product-surface + 1 storage contract = 133 passed, 0 failed;
- strict all-targets Clippy: success;
- strict release/no-default-features Clippy: success;
- locked Rust build: success;
- portable release smoke artifact and diagnostics: success;
- ready fixed-drive target selection and verified cleanup: success;
- aggregate failure gates: clean.

## Merge evidence

PR #29, `0034: harden async native consistency`, was squash-merged into `main` as `4276f04e085f4bccb4d0d956266a9b13cd56c873`.
