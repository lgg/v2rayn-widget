# 0029 - Safe Close and Small Work-Area Hardening

## Status

Implementation in progress; exact-head Release Quality and merge pending.

## Context

Task 0028 completed a product-surface audit and merged its fixes into `main` as commit `1333c415f216f83d15c45da43f23a23d22df2907`. This task performs a second independent audit from that exact baseline instead of treating the previous report as proof.

The repeated review traced every declared screen, adapter capability, frontend Tauri invocation, native close path, draft lifecycle and window-fitting claim through the current implementation.

## Objective

Close every newly confirmed repository-controlled gap between the documented product behavior and the actual React/Tauri implementation, with permanent regression contracts and a clean release-quality build.

## In scope

- Main, Settings, Debug Tools and Happ Setup local surfaces;
- external Diagnostics window lifecycle and work-area fitting;
- custom and native auxiliary-window close behavior;
- unsaved Settings/Happ draft preservation;
- frontend `invoke` to Rust handler registration parity;
- multi-monitor, small-screen and RDP work-area geometry;
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
3. Settings, Debug and Happ Setup contained direct native `.hide()` fallbacks that bypassed the backend invariant requiring Main restoration before auxiliary hide.
4. A failed Settings **Discard changes** close cleared the dirty flag even though the window and unsaved draft remained visible.
5. A failed Happ Setup discard close dismissed its confirmation while the draft remained open.
6. Native Debug close failures were logged only in Rust and did not reach the user-visible error surface used by custom close.
7. Happ Setup initial-load effect depended on the translated `t` function and could reload backend settings over an unsaved draft after a language change.
8. `docs/architecture.md` still described an obsolete quality workflow that installed dependencies normally and built an NSIS installer, contradicting the current validation-only self-hosted policy.

## Affected parts

- `src/frontend/src/app/SettingsWindow.tsx`
- `src/frontend/src/app/DebugWindow.tsx`
- `src/frontend/src/app/HappSetupWindow.tsx`
- `src/frontend/src/main.tsx`
- `src/frontend/src/lib/api.ts`
- close feedback component, event helper, locales and component tests;
- `src/tauri/src/main.rs`
- `src/tauri/src/utils/window_position.rs`
- `src/tauri/tests/product_surface_contracts.rs`
- `README.md`, `docs/architecture.md`, roadmap and this task/report.

## Acceptance criteria

- [x] Auxiliary React surfaces never hide their native window directly.
- [x] Failed safe close leaves the source window visible and shows an accessible localized alert.
- [x] Native Debug close uses the same frontend safe-close/feedback path as its custom close button.
- [x] Settings keeps its dirty flag and discard confirmation after a failed close.
- [x] Happ Setup keeps its draft and discard confirmation after a failed close.
- [x] Happ Setup does not reload and overwrite an unsaved draft when language changes.
- [x] Main, Debug and Diagnostics native minimum sizes are capped to the current available inner work area.
- [x] Preferred minima are restored on larger monitors before final size and position clamping.
- [x] Every frontend Tauri invocation has an exact registered Rust handler and vice versa.
- [x] EN/RU catalogs remain in exact parity and contain nonblank values.
- [x] v2rayN/Happ capability declarations remain truthful and unchanged where no new stable contract exists.
- [ ] README, architecture, roadmap and report reflect the final implementation and CI policy.
- [ ] Frontend audit/tests/build pass on the exact PR head.
- [ ] Rust fmt, tests, both strict Clippy configurations, locked check and portable build pass on the exact PR head.
- [ ] Artifacts, diagnostics and cleanup complete successfully.
- [ ] Temporary/noncompliant workflow files are absent from the final diff.
- [ ] PR is squash-merged into `main` and final evidence is recorded.

## Verification plan

1. Review the complete branch diff against baseline `1333c415f216f83d15c45da43f23a23d22df2907`.
2. Run permanent frontend component/contracts, npm audit and production build.
3. Run complete Rust formatting, unit/integration tests, strict all-targets Clippy, strict release/no-default-features Clippy and locked check.
4. Produce and upload the locked portable release smoke artifact and diagnostics.
5. Inspect diagnostic artifacts and aggregate failure gates rather than relying only on continue-on-error step presentation.
6. Squash-merge only the exact green head.
7. Re-run the permanent gate for the final evidence-only tracking PR if one is needed.

## Questions and decisions

- No user clarification was required. Conservative behavior is to keep an auxiliary window and any draft visible whenever Main restoration or close IPC cannot be proven successful.
- Native minimum sizes remain preferred UX constraints, but are dynamically lowered only when the active work area cannot contain them and restored when sufficient space returns.
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
- `project-tracking/reports/0029-close-and-small-work-area-hardening-report.md`
