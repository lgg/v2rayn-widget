# 0034 - Async and Native Consistency

## Status

Implementation complete on audit branch; final exact-head verification and merge pending.

## Audited baseline

main commit b9f21bd2559738670d7f97bbe2a7a649ee7daec2.

## Confirmed findings

1. Tray commands captured selected_client separately from backend dispatch.
2. Date.parse lost Rust status sub-millisecond precision.
3. Settings and tray listeners registered after initial loads began.
4. A settings event could invalidate Main bootstrap without replacement startup refresh.
5. Settings and Happ Setup could remain loading after an authoritative event.
6. Release Quality allowed non-fixed drives and silently ignored cleanup failures.
7. The default Unknown placeholder carried a current timestamp and could reject a real cached/startup status.
8. A failed stale live settings write could surface a false error after a newer authoritative settings event.
9. Auxiliary-window tests emitted React act warnings, while one source contract was coupled to one-line formatter layout.

## Acceptance criteria

- [x] Tray operations use one captured backend context and suppress stale outcomes.
- [x] RFC3339 nanosecond freshness is preserved and placeholder status is always older than backend status.
- [x] Listener registration precedes settings bootstrap/load on every affected surface.
- [x] Initial settings events trigger startup status/profile refresh.
- [x] Authoritative events end auxiliary loading.
- [x] Stale live-save failures do not surface after newer authoritative settings.
- [x] CI uses ready fixed drives and verifies cleanup.
- [x] React test state transitions are act-wrapped and act warnings fail CI.
- [x] Source contracts validate behavior without depending on formatter line wrapping.
- [x] Regressions cover all confirmed boundaries.
- [ ] Final exact-head Release Quality passes.
- [ ] PR is squash-merged and evidence recorded.
