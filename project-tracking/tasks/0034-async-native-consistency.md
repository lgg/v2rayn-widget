# 0034 - Async and Native Consistency

## Status

Implementation complete on audit branch; exact-head verification and merge pending.

## Audited baseline

main commit b9f21bd2559738670d7f97bbe2a7a649ee7daec2.

## Confirmed findings

1. Tray commands captured selected_client separately from backend dispatch.
2. Date.parse lost Rust status sub-millisecond precision.
3. Settings and tray listeners registered after initial loads began.
4. A settings event could invalidate Main bootstrap without replacement startup refresh.
5. Settings and Happ Setup could remain loading after an authoritative event.
6. Release Quality allowed non-fixed drives and silently ignored cleanup failures.

## Acceptance criteria

- [x] Tray operations use one captured backend context and suppress stale outcomes.
- [x] RFC3339 nanosecond freshness is preserved.
- [x] Listener registration precedes settings bootstrap/load on every affected surface.
- [x] Initial settings events trigger startup status/profile refresh.
- [x] Authoritative events end auxiliary loading.
- [x] CI uses ready fixed drives and verifies cleanup.
- [x] Regressions cover the confirmed boundaries.
- [ ] Exact-head Release Quality passes.
- [ ] PR is squash-merged and evidence recorded.
