$ErrorActionPreference = 'Stop'

function Replace-Exact {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Old,
        [Parameter(Mandatory = $true)][string]$New
    )

    $oldNormalized = $Old.Replace("`r`n", "`n").TrimStart("`r", "`n")
    $newNormalized = $New.Replace("`r`n", "`n").TrimStart("`r", "`n")
    $text = [System.IO.File]::ReadAllText($Path).Replace("`r`n", "`n")
    $matches = ([regex]::Matches($text, [regex]::Escape($oldNormalized))).Count
    if ($matches -ne 1) {
        throw "Expected exactly one match in $Path, found $matches"
    }

    [System.IO.File]::WriteAllText(
        $Path,
        $text.Replace($oldNormalized, $newNormalized),
        [System.Text.UTF8Encoding]::new($false)
    )
}

Replace-Exact 'src/tauri/src/services/happ_ui.rs' @'
        let title = sanitize_window_title(&get_window_title(hwnd));
        match scan_controls(hwnd, false) {
'@ @'
        let title = sanitize_window_title(&get_window_title(hwnd));
        let require_onscreen = !unsafe { IsIconic(hwnd).as_bool() };
        match scan_controls(hwnd, require_onscreen) {
'@

Replace-Exact 'docs/architecture.md' @'
The controller in `services/happ_ui.rs`:

1. receives the detected Happ PID;
2. enumerates visible windows belonging only to that PID;
3. selects the best application window;
4. scans its UI Automation subtree;
5. accepts only explicit English/Russian Connect or Disconnect actions;
6. rejects Auto connect, Reconnect and connection-settings labels;
7. requires a high confidence score;
8. clicks through Invoke, Toggle, LegacyAccessible or native button fallback;
9. refreshes status after the action;
10. fails without clicking when identification is ambiguous.

Connection state is inferred from the visible action:
'@ @'
The controller in `services/happ_ui.rs`:

1. receives the detected Happ PID;
2. enumerates visible windows belonging only to that PID;
3. selects the best application window;
4. scans its UI Automation subtree;
5. accepts only explicit English/Russian Connect or Disconnect actions;
6. rejects Auto connect, Reconnect and connection-settings labels;
7. requires a high confidence score;
8. waits for a unique high-confidence action after a cold process start;
9. restores a previously minimized window for one onscreen click;
10. keeps the window restored while confirming the expected state;
11. performs a fast local status refresh without blocking on network diagnostics;
12. restores the original minimized state after confirmation or failure;
13. fails without clicking when identification is ambiguous.

A read-only probe may classify an exact enabled action while the top-level Happ window itself is minimized. The click path still requires an enabled onscreen control, so hidden controls in a normal window are not promoted into actionable state.

Connection state is inferred from the reliable action:
'@

Replace-Exact 'src/tauri/tests/product_surface_contracts.rs' @'
    let commands = include_str!("../src/commands/mod.rs");
    assert!(commands.contains(".min_inner_size(760.0, 520.0)"));
}
'@ @'
    let commands = include_str!("../src/commands/mod.rs");
    assert!(commands.contains(".min_inner_size(760.0, 520.0)"));
}

#[test]
fn happ_toggle_confirms_before_restoring_the_original_minimized_state() {
    let adapter = include_str!("../src/adapters/happ.rs");
    let confirmation = adapter
        .find("let confirmation: Result<DashboardStatus, String>")
        .expect("Happ toggle confirmation phase");
    let restoration = adapter
        .find("happ_ui::restore_window_after_toggle")
        .expect("Happ minimized-state restoration");

    assert!(confirmation < restoration);
    assert!(adapter.contains("refresh(settings, false, false, false)"));

    let controller = include_str!("../src/services/happ_ui.rs");
    assert!(controller.contains("restore_minimized: was_minimized"));
    assert!(controller.contains("scan_controls(hwnd, true)"));
    assert!(controller.contains("let require_onscreen = !unsafe { IsIconic(hwnd).as_bool() }"));
}
'@

Write-Host '0031 follow-up contracts applied successfully.'
