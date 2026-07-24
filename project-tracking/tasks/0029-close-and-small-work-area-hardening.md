# 0029 - Safe Close and Small Work-Area Hardening

## Status

Complete. The exact implementation head passed the permanent Windows release-quality gate and PR #19 was squash-merged into `main` as commit `758eaf27ed1784235ac48ea4351fcb0bfe8220c7`.

## Context

Task 0028 completed a product-surface audit and merged its fixes into `main` as commit `1333c415f216f83d15c45da43f23a23d22df2907`. This task performs a second independent audit from that exact baseline instead of treating the previous report as proof.

The repeated review traced every declared screen, adapter capability, frontend Tauri invocation, native close path, draft lifecycle, client-context transition and window-fitting claim through the current implementation.

## Objective

Close every newly confirmed repository-controlled gap between the documented product behavior and the actual React/Tauri implementation, with permanent regression contracts and a clean release-quality build.

## In scope

- Main, Settings, Debug Tools and Happ Setup local surfaces;
- external Diagnostics window lifecycle and work-area fitting;
- custom and native auxiliary-window close behavior;
- unsaved Settings/Happ draft preservation;
- frontend `invoke` to Rust handler registration parity;
- multi-monitor, high-DPI, small-screen and RDP work-area geometry;
- adapter operation serialization and context invalidation;
- EN/RU close-failure feedback;
- v2rayN/Happ capability matrix re-verification;
- README, architecture and roadmap accuracy;
- full permanent Release Quality verification.

## Out of scope

- implementing capabilities still explicitly marked unsupported or research-required;
- declaring experimental UI Automation stable;
- testing every historical v2rayN/Happ release, Windows language, DPI and desktop-session combination;
- changing release publishing or installer policy.

## Confirmed findings

1. Native minimum window sizes could override a smaller fitted target and push Main, Debug or Diagnostics beyond a tiny/RDP monitor work area.
2. Restoring a preferred native minimum after moving back to a larger monitor could expand the window after position calculation and put its edge outside the work area.
3. Preferred sizes declared in Tauri configuration are logical pixels; treating them as physical pixels would under-size restored minima on 150-200% DPI displays.
4. Settings, Debug and Happ Setup contained direct native `.hide()` fallbacks that bypassed the backend invariant requiring Main restoration before auxiliary hide.
5. A failed Settings **Discard changes** close cleared the dirty flag even though the window and unsaved draft remained visible.
6. A failed Happ Setup discard close dismissed its confirmation while the draft remained open.
7. Native Debug close failures were logged only in Rust and did not reach the user-visible error surface used by custom close.
8. Happ Setup initial-load effect depended on the translated `t` function and could reload backend settings over an unsaved draft after a language change.
9. `docs/architecture.md` still described an obsolete quality workflow that installed dependencies normally and built an NSIS installer, contradicting the current validation-only self-hosted policy.
10. Fixed-size Settings and Happ Setup windows were shrunk to fit a constrained/RDP work area but had no configured-size restoration path, so they could remain permanently undersized after returning to a larger monitor.
11. A failed-close banner remained in the hidden webview state after a later successful close and could reappear as a stale error when the auxiliary window was opened again.
12. Saved-position validation described a visible drag area but accepted any sufficiently large body intersection. Final work-area fitting still bounded the window, but the restore-versus-center decision did not reflect the frameless window's actual top drag affordance.
13. Saving Happ settings while v2rayN was selected invalidated the active client epoch and could make an unrelated in-flight v2rayN refresh/toggle report `CLIENT_CONTEXT_CHANGED`. Re-saving unchanged active Happ settings also reset status unnecessarily.

## Affected parts

- `src/frontend/src/app/SettingsWindow.tsx`
- `src/frontend/src/app/DebugWindow.tsx`
- `src/frontend/src/app/HappSetupWindow.tsx`
- `src/frontend/src/main.tsx`
- `src/frontend/src/lib/api.ts`
- close feedback component, event helper, locales and component tests;
- `src/tauri/src/main.rs`
- `src/tauri/src/client_commands.rs`
- `src/tauri/src/utils/window_position.rs`
- `src/tauri/tests/product_surface_contracts.rs`
- `README.md`, `docs/architecture.md`, roadmap and this task/report.

## Acceptance criteria

- [x] Auxiliary React surfaces never hide their native window directly.
- [x] Failed safe close leaves the source window visible and shows an accessible localized alert.
- [x] A new close attempt clears stale failure feedback for that window before reporting its own result.
- [x] Native Debug close uses the same frontend safe-close/feedback path as its custom close button.
- [x] Settings keeps its dirty flag and discard confirmation after a failed close.
- [x] Happ Setup keeps its draft and discard confirmation after a failed close.
- [x] Happ Setup does not reload and overwrite an unsaved draft when language changes.
- [x] Main, Debug and Diagnostics native minimum sizes are capped to the current available inner work area.
- [x] Preferred logical minima are converted using the active window DPI scale factor.
- [x] Preferred minima are restored on larger monitors before final size and position clamping.
- [x] Fixed Settings/Happ windows restore their configured DPI-scaled size when the work area can contain it and remain bounded when it cannot.
- [x] Saved-position restoration requires the actual top drag strip to remain visible; otherwise the window is centered before final fitting.
- [x] Inactive Happ settings updates preserve the active v2rayN epoch and status.
- [x] Unchanged active Happ settings preserve context, while real active Happ control/path changes invalidate context and clear stale status.
- [x] Every frontend Tauri invocation has an exact, non-duplicated registered Rust handler and vice versa.
- [x] EN/RU catalogs remain in exact parity and contain nonblank values.
- [x] v2rayN/Happ capability declarations remain truthful and unchanged where no new stable contract exists.
- [x] README, architecture, roadmap and report reflect the final implementation and CI policy.
- [x] Frontend audit/tests/build pass on the exact PR head.
- [x] Rust fmt, tests, both strict Clippy configurations, locked check and portable build pass on the exact PR head.
- [x] Artifacts, diagnostics and cleanup complete successfully.
- [x] Temporary/noncompliant workflow files are absent from the final diff.
- [x] PR is squash-merged into `main` and final evidence is recorded.

## Final verification evidence

Exact implementation head `524e044ac6e864e351bcf035f237b322890d0d68` passed Release Quality #360 (`30117873904`) on the dedicated `[self-hosted, v2rayn-widget-ci]` Windows runner.

- frontend dependency audit, complete tests and production build: success;
- full Rust formatting: success;
- Rust unit/integration tests: 119 passed, 0 failed;
- strict all-targets Clippy: success;
- strict release/no-default-features Clippy: success;
- locked Rust build: success;
- portable release smoke artifact, diagnostics and cleanup: success;
- aggregate failure gates: clean.

PR #19 was then squash-merged into `main` as `758eaf27ed1784235ac48ea4351fcb0bfe8220c7`. This evidence-only update changes no product implementation.

## Questions and decisions

- No user clarification was required. Conservative behavior is to keep an auxiliary window and any draft visible whenever Main restoration or close IPC cannot be proven successful.
- Native minimum sizes remain preferred UX constraints, but are converted from logical to physical units, dynamically lowered only when the active work area cannot contain them and restored when sufficient space returns.
- Fixed Settings/Happ sizes are also DPI-scaled preferences: they shrink only as required by the active work area and are restored on the next application-controlled show/fitting pass.
- Saved-position validity is based on the actual top drag strip. Final fitting remains the second recovery layer even when a saved position is accepted.
- Close failure feedback belongs to one attempt and one window label; a subsequent attempt clears stale state before invoking Rust.
- Adapter epoch invalidation is reserved for actual operational-context changes. Updating an inactive adapter or re-saving identical active settings must not disturb the current route/status.
- Experimental and unsupported adapter capabilities are not promoted merely to make the matrix look complete.

## Risks

- Tauri/Windows can apply native size changes asynchronously; deterministic geometry tests cover calculations, while the Windows release build remains the integration gate.
- Real UI Automation still depends on installed client version, visible interactive desktop and matching privilege context.
- A user-visible close failure is preferable to silently hiding the last reachable auxiliary surface.

## Security and redaction review

- No credentials, private endpoints, subscription data, local user paths, runtime configs or private logs are included.
- Test paths and URLs are neutral placeholders or public examples.
- Remote Diagnostics remains excluded from the default Tauri IPC capability.

## Related work

- Task/report 0028 - Product Surface Completeness Audit.
- PR #17 - completed product-surface fixes.
- PR #18 - completed 0028 evidence.
- PR #19 - completed 0029 implementation and audit fixes.
- `project-tracking/reports/0029-close-and-small-work-area-hardening-report.md`
