import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

function write(path, content) {
  fs.writeFileSync(path, content.replace(/\r\n/g, "\n"));
}

function replaceOnce(path, before, after) {
  const source = read(path);
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing expected block in ${path}: ${before.slice(0, 120)}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Expected unique block in ${path}`);
  }
  write(path, source.slice(0, first) + after + source.slice(first + before.length));
}

function replaceAllExact(path, before, after, expectedCount) {
  const source = read(path);
  const count = source.split(before).length - 1;
  if (count !== expectedCount) {
    throw new Error(`Expected ${expectedCount} occurrences in ${path}, found ${count}`);
  }
  write(path, source.split(before).join(after));
}

const debugTest = "src/frontend/src/app/DebugWindow.test.tsx";
replaceAllExact(debugTest, "    render(<DebugWindow />);", "    await renderDebugWindow();", 4);
replaceOnce(
  debugTest,
  'const settings: AppSettings = {',
  `async function renderDebugWindow(): Promise<void> {
  await act(async () => {
    render(<DebugWindow />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const settings: AppSettings = {`,
);

const happTest = "src/frontend/src/app/HappSetupWindow.test.tsx";
const happSource = read(happTest);
const happRenderCount = happSource.split("    render(<HappSetupWindow />);").length - 1;
if (happRenderCount < 8) {
  throw new Error(`Expected at least 8 HappSetupWindow renders, found ${happRenderCount}`);
}
write(happTest, happSource.split("    render(<HappSetupWindow />);").join("    await renderHappSetupWindow();"));
replaceOnce(
  happTest,
  'const settings: AppSettings = {',
  `async function renderHappSetupWindow(): Promise<void> {
  await act(async () => {
    render(<HappSetupWindow />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const settings: AppSettings = {`,
);

const productContracts = "src/tauri/tests/product_surface_contracts.rs";
replaceOnce(
  productContracts,
  `    assert!(app.contains("bindTauriListener<TrayStatusUpdate>(\\"tray-status-updated\\""));
    assert!(app.contains("bindTauriListener<TrayOperationError>(\\"tray-operation-error\\""));`,
  `    assert!(app.contains("bindTauriListener<TrayStatusUpdate>("));
    assert!(app.contains("\\"tray-status-updated\\","));
    assert!(app.contains("bindTauriListener<TrayOperationError>("));
    assert!(app.contains("\\"tray-operation-error\\","));`,
);

const workflowContracts = "scripts/test-workflow-contracts.mjs";
replaceOnce(
  workflowContracts,
  '    ["Rust cleanup left generated paths", "verified Rust cleanup"],',
  `    ["Rust cleanup left generated paths", "verified Rust cleanup"],
    ["Frontend tests emitted React act warnings", "warning-free React tests"],`,
);

const finalWorkflow = "scripts/windows-quality-final.yml";
replaceOnce(
  finalWorkflow,
  `          npm test 2>&1 | Tee-Object -FilePath frontend-test-output.txt
          exit $LASTEXITCODE`,
  `          npm test 2>&1 | Tee-Object -FilePath frontend-test-output.txt
          $testExitCode = $LASTEXITCODE
          $actWarnings = Select-String -Path frontend-test-output.txt -SimpleMatch "was not wrapped in act"
          if ($actWarnings) {
            Write-Error "Frontend tests emitted React act warnings"
            exit 1
          }
          exit $testExitCode`,
);

write(
  "project-tracking/tasks/0034-async-native-consistency.md",
  `# 0034 - Async and Native Consistency

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
`,
);

write(
  "project-tracking/reports/0034-async-native-consistency-report.md",
  `# 0034 - Async and Native Consistency Audit Report

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
`,
);

console.log("0034 final cleanup applied");
