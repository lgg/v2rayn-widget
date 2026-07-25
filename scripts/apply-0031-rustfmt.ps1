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

Replace-Exact 'src/tauri/src/adapters/happ.rs' @'
    let restore_error = happ_ui::restore_window_after_toggle(
        process.pid,
        outcome.restore_minimized,
    )
    .err()
    .map(|error| error.to_string());
'@ @'
    let restore_error =
        happ_ui::restore_window_after_toggle(process.pid, outcome.restore_minimized)
            .err()
            .map(|error| error.to_string());
'@

Replace-Exact 'src/tauri/src/services/happ_ui.rs' @'
            if is_clickable(control_type)
                && element_is_action_candidate(&element, require_onscreen)
            {
'@ @'
            if is_clickable(control_type) && element_is_action_candidate(&element, require_onscreen)
            {
'@

Replace-Exact 'src/tauri/src/services/happ_ui.rs' @'
    fn element_is_action_candidate(
        element: &IUIAutomationElement,
        require_onscreen: bool,
    ) -> bool {
'@ @'
    fn element_is_action_candidate(element: &IUIAutomationElement, require_onscreen: bool) -> bool {
'@

Write-Host '0031 canonical Rust formatting applied successfully.'
