$ErrorActionPreference = 'Stop'

function Replace-Exact {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Old,
        [Parameter(Mandatory = $true)][string]$New
    )

    $oldNormalized = $Old.Replace("`r`n", "`n").TrimStart("`r", "`n")
    $newNormalized = $New.Replace("`r`n", "`n").TrimStart("`r", "`n")
    $text = [System.IO.File]::ReadAllText($Path)
    $matches = ([regex]::Matches($text, [regex]::Escape($oldNormalized))).Count
    if ($matches -ne 1) {
        throw "Expected exactly one match in $Path, found $matches"
    }

    $updated = $text.Replace($oldNormalized, $newNormalized)
    [System.IO.File]::WriteAllText(
        $Path,
        $updated,
        [System.Text.UTF8Encoding]::new($false)
    )
}

$uiPath = 'src/tauri/src/services/happ_ui.rs'
$adapterPath = 'src/tauri/src/adapters/happ.rs'

Replace-Exact $uiPath @'
#[derive(Debug, Clone)]
pub struct HappToggleOutcome {
    pub note: String,
    pub expected_state: ConnectionState,
}

const MIN_ACTION_SCORE: i32 = 220;
'@ @'
#[derive(Debug, Clone)]
pub struct HappToggleOutcome {
    pub note: String,
    pub expected_state: ConnectionState,
    pub restore_minimized: bool,
}

const MIN_ACTION_SCORE: i32 = 220;

pub fn control_ready(snapshot: &HappUiSnapshot) -> bool {
    snapshot.window_found
        && snapshot.action_label.is_some()
        && snapshot
            .action_score
            .is_some_and(|score| score >= MIN_ACTION_SCORE)
}

fn action_candidate_is_eligible(enabled: bool, offscreen: bool, require_onscreen: bool) -> bool {
    enabled && (!require_onscreen || !offscreen)
}
'@

Replace-Exact $uiPath @'
        match scan_controls(hwnd) {
'@ @'
        match scan_controls(hwnd, false) {
'@

Replace-Exact $uiPath @'
    pub fn toggle_connection(process_id: Option<u32>) -> Result<HappToggleOutcome> {
        let process_id = process_id.ok_or_else(|| anyhow!("Happ process is not running"))?;
        let hwnd = find_happ_window(process_id)
            .ok_or_else(|| anyhow!("Happ application window was not found"))?;
        let was_minimized = bring_to_front(hwnd);

        let result = (|| -> Result<HappToggleOutcome> {
            let scan = scan_controls(hwnd)?;
            if scan.ambiguous_action {
                return Err(anyhow!(
                    "Multiple equally plausible Happ Connect/Disconnect controls were found; refusing to click"
                ));
            }
            let candidate = scan.action.ok_or_else(|| {
                anyhow!(
                    "No unique high-confidence Happ Connect/Disconnect control was found. Run the Happ diagnostics probe and keep using the application directly."
                )
            })?;
            if candidate.score < MIN_ACTION_SCORE {
                return Err(anyhow!(
                    "Happ action confidence {} is below the required threshold {MIN_ACTION_SCORE}",
                    candidate.score
                ));
            }

            let method = click_element(&candidate.element)?;
            let action_label = canonical_action_label(candidate.inferred_state);
            Ok(HappToggleOutcome {
                note: format!(
                    "Clicked Happ connection action via {method}: {action_label} [score={}]",
                    candidate.score
                ),
                expected_state: expected_state_after_action(candidate.inferred_state),
            })
        })();

        restore_window_state(hwnd, was_minimized);
        result
    }

    fn scan_controls(hwnd: HWND) -> Result<ScanResult> {
'@ @'
    pub fn toggle_connection(process_id: Option<u32>) -> Result<HappToggleOutcome> {
        let process_id = process_id.ok_or_else(|| anyhow!("Happ process is not running"))?;
        let hwnd = find_happ_window(process_id)
            .ok_or_else(|| anyhow!("Happ application window was not found"))?;
        let was_minimized = bring_to_front(hwnd);

        let result = (|| -> Result<HappToggleOutcome> {
            let scan = scan_controls(hwnd, true)?;
            if scan.ambiguous_action {
                return Err(anyhow!(
                    "Multiple equally plausible Happ Connect/Disconnect controls were found; refusing to click"
                ));
            }
            let candidate = scan.action.ok_or_else(|| {
                anyhow!(
                    "No unique high-confidence Happ Connect/Disconnect control was found. Run the Happ diagnostics probe and keep using the application directly."
                )
            })?;
            if candidate.score < MIN_ACTION_SCORE {
                return Err(anyhow!(
                    "Happ action confidence {} is below the required threshold {MIN_ACTION_SCORE}",
                    candidate.score
                ));
            }

            let method = click_element(&candidate.element)?;
            let action_label = canonical_action_label(candidate.inferred_state);
            Ok(HappToggleOutcome {
                note: format!(
                    "Clicked Happ connection action via {method}: {action_label} [score={}]",
                    candidate.score
                ),
                expected_state: expected_state_after_action(candidate.inferred_state),
                restore_minimized: was_minimized,
            })
        })();

        match result {
            Ok(outcome) => Ok(outcome),
            Err(error) => {
                restore_window_state(hwnd, was_minimized);
                Err(error)
            }
        }
    }

    pub fn restore_window_after_toggle(
        process_id: Option<u32>,
        restore_minimized: bool,
    ) -> Result<()> {
        if !restore_minimized {
            return Ok(());
        }

        let process_id = process_id.ok_or_else(|| anyhow!("Happ process is not running"))?;
        let hwnd = find_happ_window(process_id)
            .ok_or_else(|| anyhow!("Happ application window was not found"))?;
        restore_window_state(hwnd, true);
        Ok(())
    }

    fn scan_controls(hwnd: HWND, require_onscreen: bool) -> Result<ScanResult> {
'@

Replace-Exact $uiPath @'
            if is_clickable(control_type) && element_is_interactable(&element) {
                if let Some((state, base_score)) = classify_connection_action(&name) {
'@ @'
            if is_clickable(control_type)
                && element_is_action_candidate(&element, require_onscreen)
            {
                if let Some((state, base_score)) = classify_connection_action(&name) {
'@

Replace-Exact $uiPath @'
    fn element_is_interactable(element: &IUIAutomationElement) -> bool {
        let enabled = unsafe { element.CurrentIsEnabled() }
            .map(|value| value.as_bool())
            .unwrap_or(false);
        let offscreen = unsafe { element.CurrentIsOffscreen() }
            .map(|value| value.as_bool())
            .unwrap_or(true);
        enabled && !offscreen
    }
'@ @'
    fn element_is_action_candidate(
        element: &IUIAutomationElement,
        require_onscreen: bool,
    ) -> bool {
        let enabled = unsafe { element.CurrentIsEnabled() }
            .map(|value| value.as_bool())
            .unwrap_or(false);
        let offscreen = unsafe { element.CurrentIsOffscreen() }
            .map(|value| value.as_bool())
            .unwrap_or(true);
        action_candidate_is_eligible(enabled, offscreen, require_onscreen)
    }
'@

Replace-Exact $uiPath @'
#[cfg(not(target_os = "windows"))]
pub fn toggle_connection(_process_id: Option<u32>) -> anyhow::Result<HappToggleOutcome> {
    anyhow::bail!("Happ UI Automation is only available on Windows")
}

#[cfg(test)]
'@ @'
#[cfg(not(target_os = "windows"))]
pub fn toggle_connection(_process_id: Option<u32>) -> anyhow::Result<HappToggleOutcome> {
    anyhow::bail!("Happ UI Automation is only available on Windows")
}

#[cfg(target_os = "windows")]
pub fn restore_window_after_toggle(
    process_id: Option<u32>,
    restore_minimized: bool,
) -> anyhow::Result<()> {
    windows_impl::restore_window_after_toggle(process_id, restore_minimized)
}

#[cfg(not(target_os = "windows"))]
pub fn restore_window_after_toggle(
    _process_id: Option<u32>,
    _restore_minimized: bool,
) -> anyhow::Result<()> {
    Ok(())
}

#[cfg(test)]
'@

Replace-Exact $uiPath @'
    #[test]
    fn multiple_plausible_actions_are_rejected() {
        assert_eq!(select_unique_candidate_index(0), None);
        assert_eq!(select_unique_candidate_index(1), Some(0));
        assert_eq!(select_unique_candidate_index(2), None);
    }

    #[test]
    fn conflicting_selected_transports_are_unknown() {
'@ @'
    #[test]
    fn multiple_plausible_actions_are_rejected() {
        assert_eq!(select_unique_candidate_index(0), None);
        assert_eq!(select_unique_candidate_index(1), Some(0));
        assert_eq!(select_unique_candidate_index(2), None);
    }

    #[test]
    fn read_probes_accept_exact_offscreen_actions_but_clicks_do_not() {
        assert!(action_candidate_is_eligible(true, true, false));
        assert!(!action_candidate_is_eligible(true, true, true));
        assert!(action_candidate_is_eligible(true, false, true));
        assert!(!action_candidate_is_eligible(false, false, false));
    }

    #[test]
    fn control_readiness_requires_a_high_confidence_action() {
        let ready = HappUiSnapshot {
            window_found: true,
            action_label: Some("Connect".to_owned()),
            action_score: Some(MIN_ACTION_SCORE),
            ..HappUiSnapshot::default()
        };
        assert!(control_ready(&ready));

        let low_score = HappUiSnapshot {
            action_score: Some(MIN_ACTION_SCORE - 1),
            ..ready.clone()
        };
        assert!(!control_ready(&low_score));

        let missing_action = HappUiSnapshot {
            action_label: None,
            ..ready
        };
        assert!(!control_ready(&missing_action));
    }

    #[test]
    fn conflicting_selected_transports_are_unknown() {
'@

Replace-Exact $adapterPath @'
pub async fn toggle(settings: &AppSettings) -> Result<DashboardStatus, String> {
    if !settings.happ_allow_ui_automation {
        return Err(
            "HAPP_UI_AUTOMATION_DISABLED: Open Happ setup and explicitly enable experimental Windows UI Automation control."
                .to_owned(),
        );
    }

    let mut process = read_process_snapshot_for_settings(settings);
    if !process.running {
        open(settings)?;
        for _ in 0..20 {
            tokio::time::sleep(std::time::Duration::from_millis(250)).await;
            process = read_process_snapshot_for_settings(settings);
            if process.running {
                break;
            }
        }
    }

    if !process.running {
        return Err(
            "HAPP_START_TIMEOUT: Happ was launched but its process was not detected".to_owned(),
        );
    }

    let outcome = happ_ui::toggle_connection(process.pid).map_err(|error| error.to_string())?;
    for _ in 0..20 {
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        let observed = happ_ui::probe(process.pid);
        if observed.connection_state == outcome.expected_state {
            let mut status = refresh(settings, true, true, false)
                .await
                .map_err(|error| error.to_string())?;
            status.last_event = Some(format!(
                "{}; confirmed state={:?}",
                outcome.note, outcome.expected_state
            ));
            return Ok(status);
        }
    }

    Err(format!(
        "HAPP_TOGGLE_UNCONFIRMED: {}. The click was sent, but Happ did not expose the expected {:?} state within 5 seconds.",
        outcome.note, outcome.expected_state
    ))
}
'@ @'
pub async fn toggle(settings: &AppSettings) -> Result<DashboardStatus, String> {
    if !settings.happ_allow_ui_automation {
        return Err(
            "HAPP_UI_AUTOMATION_DISABLED: Open Happ setup and explicitly enable experimental Windows UI Automation control."
                .to_owned(),
        );
    }

    let mut process = read_process_snapshot_for_settings(settings);
    if !process.running {
        open(settings)?;
        for _ in 0..20 {
            tokio::time::sleep(std::time::Duration::from_millis(250)).await;
            process = read_process_snapshot_for_settings(settings);
            if process.running {
                break;
            }
        }
    }

    if !process.running {
        return Err(
            "HAPP_START_TIMEOUT: Happ was launched but its process was not detected".to_owned(),
        );
    }

    let mut ready = false;
    for _ in 0..20 {
        let observed = happ_ui::probe(process.pid);
        if happ_ui::control_ready(&observed) {
            ready = true;
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
    }
    if !ready {
        return Err(
            "HAPP_CONTROL_NOT_READY: Happ is running, but no unique high-confidence Connect/Disconnect action became available within 5 seconds."
                .to_owned(),
        );
    }

    let outcome = happ_ui::toggle_connection(process.pid).map_err(|error| error.to_string())?;
    let confirmation: Result<DashboardStatus, String> = async {
        for _ in 0..20 {
            tokio::time::sleep(std::time::Duration::from_millis(250)).await;
            let observed = happ_ui::probe(process.pid);
            if observed.connection_state == outcome.expected_state {
                let mut status = refresh(settings, false, false, false)
                    .await
                    .map_err(|error| error.to_string())?;
                status.last_event = Some(format!(
                    "{}; confirmed state={:?}",
                    outcome.note, outcome.expected_state
                ));
                return Ok(status);
            }
        }

        Err(format!(
            "HAPP_TOGGLE_UNCONFIRMED: {}. The click was sent, but Happ did not expose the expected {:?} state within 5 seconds.",
            outcome.note, outcome.expected_state
        ))
    }
    .await;

    let restore_error = happ_ui::restore_window_after_toggle(
        process.pid,
        outcome.restore_minimized,
    )
    .err()
    .map(|error| error.to_string());

    match confirmation {
        Ok(mut status) => {
            if let Some(error) = restore_error {
                let event = status.last_event.take().unwrap_or_default();
                status.last_event = Some(format!(
                    "{event}; original minimized state could not be restored: {error}"
                ));
            }
            Ok(status)
        }
        Err(error) => {
            if let Some(restore_error) = restore_error {
                Err(format!(
                    "{error} Original minimized state could not be restored: {restore_error}"
                ))
            } else {
                Err(error)
            }
        }
    }
}
'@

Write-Host '0031 Happ toggle lifecycle patch applied successfully.'
