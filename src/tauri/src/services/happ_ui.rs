use crate::models::{client::TransportMode, status::ConnectionState};

#[derive(Debug, Clone, Default)]
pub struct HappUiSnapshot {
    pub window_found: bool,
    pub window_title: Option<String>,
    pub connection_state: ConnectionState,
    pub transport_mode: TransportMode,
    pub action_label: Option<String>,
    pub action_score: Option<i32>,
    pub ui_nodes: Vec<String>,
    pub note: String,
}

const MIN_ACTION_SCORE: i32 = 220;

fn normalize_text(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .replace(['\n', '\r', '\t'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn classify_connection_action(value: &str) -> Option<(ConnectionState, i32)> {
    let normalized = normalize_text(value);
    if normalized.is_empty() {
        return None;
    }

    let disconnect_tokens = [
        "disconnect",
        "disconnect now",
        "отключиться",
        "отключить",
        "разорвать соединение",
    ];
    if disconnect_tokens
        .iter()
        .any(|token| normalized == *token)
    {
        return Some((ConnectionState::Connected, 320));
    }

    let rejected_connect_context = [
        "auto connect",
        "autoconnect",
        "reconnect",
        "connection settings",
        "connection mode",
        "автоподключ",
        "переподключ",
        "настройки подключения",
    ];
    if rejected_connect_context
        .iter()
        .any(|token| normalized.contains(token))
    {
        return None;
    }

    let connect_tokens = ["connect", "connect now", "подключиться", "подключить"];
    if connect_tokens
        .iter()
        .any(|token| normalized == *token)
    {
        return Some((ConnectionState::Disconnected, 280));
    }

    None
}

fn classify_transport(value: &str) -> TransportMode {
    let normalized = normalize_text(value);
    match normalized.as_str() {
        "proxy" | "proxy mode" | "прокси" | "режим прокси" => TransportMode::Proxy,
        "tun" | "tun mode" | "режим tun" => TransportMode::Tun,
        "mixed" | "mixed mode" | "смешанный" | "смешанный режим" => {
            TransportMode::Mixed
        }
        _ => TransportMode::Unknown,
    }
}

#[cfg(target_os = "windows")]
mod windows_impl {
    use super::*;
    use anyhow::{anyhow, Result};
    use windows::{
        core::BOOL,
        Win32::{
            Foundation::{HWND, LPARAM, RECT, RPC_E_CHANGED_MODE, WPARAM},
            System::Com::{
                CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
                COINIT_APARTMENTTHREADED,
            },
            UI::{
                Accessibility::{
                    CUIAutomation, IUIAutomation, IUIAutomationElement, IUIAutomationInvokePattern,
                    IUIAutomationLegacyIAccessiblePattern, IUIAutomationSelectionItemPattern,
                    IUIAutomationTogglePattern, TreeScope_Subtree, UIA_ButtonControlTypeId,
                    UIA_CheckBoxControlTypeId, UIA_CustomControlTypeId, UIA_HyperlinkControlTypeId,
                    UIA_InvokePatternId, UIA_LegacyIAccessiblePatternId, UIA_MenuItemControlTypeId,
                    UIA_SelectionItemPatternId, UIA_TogglePatternId,
                },
                WindowsAndMessaging::{
                    EnumWindows, GetWindowRect, GetWindowTextLengthW, GetWindowTextW,
                    GetWindowThreadProcessId, IsIconic, IsWindowVisible, SendMessageW,
                    SetForegroundWindow, ShowWindow, BM_CLICK, SW_MINIMIZE, SW_RESTORE,
                },
            },
        },
    };

    const MAX_NODES: usize = 240;

    #[derive(Default)]
    struct WindowSearch {
        target_pid: u32,
        best: Option<(HWND, i32)>,
    }

    #[derive(Clone)]
    struct ActionCandidate {
        element: IUIAutomationElement,
        label: String,
        score: i32,
        inferred_state: ConnectionState,
    }

    #[derive(Default)]
    struct ScanResult {
        action: Option<ActionCandidate>,
        transport_mode: TransportMode,
        nodes: Vec<String>,
    }

    struct ComGuard {
        should_uninit: bool,
    }

    impl ComGuard {
        fn init() -> Result<Self> {
            let hr = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
            if hr == RPC_E_CHANGED_MODE {
                return Ok(Self {
                    should_uninit: false,
                });
            }

            hr.ok()
                .map_err(|error| anyhow!("CoInitializeEx failed: {error}"))?;
            Ok(Self {
                should_uninit: true,
            })
        }
    }

    impl Drop for ComGuard {
        fn drop(&mut self) {
            if self.should_uninit {
                unsafe { CoUninitialize() };
            }
        }
    }

    pub fn probe(process_id: Option<u32>) -> HappUiSnapshot {
        let Some(process_id) = process_id else {
            return HappUiSnapshot {
                note: "Happ process is not running".to_owned(),
                connection_state: ConnectionState::Disconnected,
                ..HappUiSnapshot::default()
            };
        };

        let Some(hwnd) = find_happ_window(process_id) else {
            return HappUiSnapshot {
                note: "Happ process was found, but no visible application window was found"
                    .to_owned(),
                connection_state: ConnectionState::Unknown,
                ..HappUiSnapshot::default()
            };
        };

        let title = get_window_title(hwnd);
        match scan_controls(hwnd) {
            Ok(scan) => HappUiSnapshot {
                window_found: true,
                window_title: (!title.is_empty()).then_some(title),
                connection_state: scan
                    .action
                    .as_ref()
                    .map(|candidate| candidate.inferred_state)
                    .unwrap_or(ConnectionState::Unknown),
                transport_mode: scan.transport_mode,
                action_label: scan
                    .action
                    .as_ref()
                    .map(|candidate| candidate.label.clone()),
                action_score: scan.action.as_ref().map(|candidate| candidate.score),
                ui_nodes: scan.nodes,
                note: if scan.action.is_some() {
                    "A high-confidence Happ connection action was found through Windows UI Automation"
                        .to_owned()
                } else {
                    "Happ window found, but no high-confidence Connect/Disconnect action was found"
                        .to_owned()
                },
            },
            Err(error) => HappUiSnapshot {
                window_found: true,
                window_title: (!title.is_empty()).then_some(title),
                connection_state: ConnectionState::Unknown,
                note: format!("Happ UI Automation probe failed: {error}"),
                ..HappUiSnapshot::default()
            },
        }
    }

    pub fn toggle_connection(process_id: Option<u32>) -> Result<String> {
        let process_id = process_id.ok_or_else(|| anyhow!("Happ process is not running"))?;
        let hwnd = find_happ_window(process_id)
            .ok_or_else(|| anyhow!("Happ application window was not found"))?;
        let was_minimized = bring_to_front(hwnd);

        let result = (|| -> Result<String> {
            let scan = scan_controls(hwnd)?;
            let candidate = scan.action.ok_or_else(|| {
                anyhow!(
                    "No high-confidence Happ Connect/Disconnect control was found. Run the Happ diagnostics probe and keep using the application directly."
                )
            })?;
            if candidate.score < MIN_ACTION_SCORE {
                return Err(anyhow!(
                    "Happ action confidence {} is below the required threshold {MIN_ACTION_SCORE}",
                    candidate.score
                ));
            }

            let method = click_element(&candidate.element)?;
            Ok(format!(
                "Clicked Happ connection action via {method}: {} [score={}]",
                candidate.label, candidate.score
            ))
        })();

        restore_window_state(hwnd, was_minimized);
        result
    }

    fn scan_controls(hwnd: HWND) -> Result<ScanResult> {
        let _com = ComGuard::init()?;
        let automation: IUIAutomation = unsafe {
            CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER)
                .map_err(|error| anyhow!("CoCreateInstance(CUIAutomation) failed: {error}"))?
        };
        let root = unsafe {
            automation
                .ElementFromHandle(hwnd)
                .map_err(|error| anyhow!("ElementFromHandle failed: {error}"))?
        };
        let condition = unsafe {
            automation
                .CreateTrueCondition()
                .map_err(|error| anyhow!("CreateTrueCondition failed: {error}"))?
        };
        let elements = unsafe {
            root.FindAll(TreeScope_Subtree, &condition)
                .map_err(|error| anyhow!("FindAll(TreeScope_Subtree) failed: {error}"))?
        };
        let count = unsafe { elements.Length() }
            .map_err(|error| anyhow!("UI Automation element count failed: {error}"))?;

        let mut result = ScanResult::default();
        for index in 0..count {
            let element = unsafe { elements.GetElement(index) }
                .map_err(|error| anyhow!("GetElement({index}) failed: {error}"))?;
            let name = unsafe { element.CurrentName() }
                .ok()
                .map(|value| value.to_string())
                .unwrap_or_default();
            let automation_id = unsafe { element.CurrentAutomationId() }
                .ok()
                .map(|value| value.to_string())
                .unwrap_or_default();
            let class_name = unsafe { element.CurrentClassName() }
                .ok()
                .map(|value| value.to_string())
                .unwrap_or_default();
            let control_type = unsafe { element.CurrentControlType() }
                .ok()
                .map(|value| value.0);
            let label = [name.trim(), automation_id.trim(), class_name.trim()]
                .into_iter()
                .filter(|value| !value.is_empty())
                .collect::<Vec<_>>()
                .join(" | ");

            if !label.is_empty() && result.nodes.len() < MAX_NODES {
                result.nodes.push(label.clone());
            }

            if is_clickable(control_type) {
                if let Some((state, base_score)) = classify_connection_action(&name) {
                    let score = base_score + clickable_score(control_type);
                    if score >= MIN_ACTION_SCORE
                        && result
                            .action
                            .as_ref()
                            .map(|current| score > current.score)
                            .unwrap_or(true)
                    {
                        result.action = Some(ActionCandidate {
                            element: element.clone(),
                            label: label.clone(),
                            score,
                            inferred_state: state,
                        });
                    }
                }
            }

            let transport = classify_transport(&name);
            if transport != TransportMode::Unknown && element_is_selected(&element) {
                result.transport_mode = transport;
            }
        }

        Ok(result)
    }

    fn element_is_selected(element: &IUIAutomationElement) -> bool {
        let Ok(pattern) = (unsafe {
            element.GetCurrentPatternAs::<IUIAutomationSelectionItemPattern>(
                UIA_SelectionItemPatternId,
            )
        }) else {
            return false;
        };

        unsafe { pattern.CurrentIsSelected() }
            .map(|selected| selected.as_bool())
            .unwrap_or(false)
    }

    fn click_element(element: &IUIAutomationElement) -> Result<&'static str> {
        unsafe {
            let _ = element.SetFocus();
        }

        if let Ok(pattern) = unsafe {
            element.GetCurrentPatternAs::<IUIAutomationInvokePattern>(UIA_InvokePatternId)
        } {
            unsafe { pattern.Invoke() }
                .map_err(|error| anyhow!("InvokePattern::Invoke failed: {error}"))?;
            return Ok("invoke_pattern");
        }

        if let Ok(pattern) = unsafe {
            element.GetCurrentPatternAs::<IUIAutomationTogglePattern>(UIA_TogglePatternId)
        } {
            unsafe { pattern.Toggle() }
                .map_err(|error| anyhow!("TogglePattern::Toggle failed: {error}"))?;
            return Ok("toggle_pattern");
        }

        if let Ok(pattern) = unsafe {
            element.GetCurrentPatternAs::<IUIAutomationLegacyIAccessiblePattern>(
                UIA_LegacyIAccessiblePatternId,
            )
        } {
            if unsafe { pattern.DoDefaultAction() }.is_ok() {
                return Ok("legacy_default_action");
            }
        }

        if let Ok(native_hwnd) = unsafe { element.CurrentNativeWindowHandle() } {
            if !native_hwnd.is_invalid() {
                unsafe {
                    let _ = SendMessageW(native_hwnd, BM_CLICK, Some(WPARAM(0)), Some(LPARAM(0)));
                }
                return Ok("bm_click_fallback");
            }
        }

        Err(anyhow!(
            "No supported UI Automation click pattern was available"
        ))
    }

    fn is_clickable(control_type: Option<i32>) -> bool {
        matches!(
            control_type,
            Some(value)
                if value == UIA_ButtonControlTypeId.0
                    || value == UIA_CheckBoxControlTypeId.0
                    || value == UIA_MenuItemControlTypeId.0
                    || value == UIA_CustomControlTypeId.0
                    || value == UIA_HyperlinkControlTypeId.0
        )
    }

    fn clickable_score(control_type: Option<i32>) -> i32 {
        match control_type {
            Some(value) if value == UIA_ButtonControlTypeId.0 => 80,
            Some(value) if value == UIA_CheckBoxControlTypeId.0 => 60,
            Some(value) if value == UIA_MenuItemControlTypeId.0 => 50,
            Some(value) if value == UIA_HyperlinkControlTypeId.0 => 35,
            Some(value) if value == UIA_CustomControlTypeId.0 => 20,
            _ => 0,
        }
    }

    fn find_happ_window(target_pid: u32) -> Option<HWND> {
        let mut search = WindowSearch {
            target_pid,
            best: None,
        };
        unsafe {
            let _ = EnumWindows(
                Some(enum_windows_proc),
                LPARAM((&mut search as *mut WindowSearch).cast::<()>() as isize),
            );
        }
        search.best.map(|entry| entry.0)
    }

    unsafe extern "system" fn enum_windows_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        if !IsWindowVisible(hwnd).as_bool() {
            return BOOL(1);
        }

        let search = &mut *(lparam.0 as *mut WindowSearch);
        let mut pid = 0_u32;
        let _ = GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid != search.target_pid {
            return BOOL(1);
        }

        let title = get_window_title(hwnd);
        let mut rect = RECT::default();
        let area = if GetWindowRect(hwnd, &mut rect).is_ok() {
            (rect.right - rect.left).max(0) * (rect.bottom - rect.top).max(0)
        } else {
            0
        };
        let title_score = if normalize_text(&title).contains("happ") {
            100_000
        } else if !title.is_empty() {
            50_000
        } else {
            0
        };
        let score = title_score + area.min(40_000);
        if search.best.map(|current| score > current.1).unwrap_or(true) {
            search.best = Some((hwnd, score));
        }

        BOOL(1)
    }

    fn get_window_title(hwnd: HWND) -> String {
        let length = unsafe { GetWindowTextLengthW(hwnd) };
        if length <= 0 {
            return String::new();
        }
        let mut buffer = vec![0_u16; (length + 1) as usize];
        let copied = unsafe { GetWindowTextW(hwnd, &mut buffer) };
        if copied <= 0 {
            return String::new();
        }
        String::from_utf16_lossy(&buffer[..copied as usize])
    }

    fn bring_to_front(hwnd: HWND) -> bool {
        let was_minimized = unsafe { IsIconic(hwnd).as_bool() };
        unsafe {
            let _ = ShowWindow(hwnd, SW_RESTORE);
            let _ = SetForegroundWindow(hwnd);
        }
        was_minimized
    }

    fn restore_window_state(hwnd: HWND, was_minimized: bool) {
        if was_minimized {
            unsafe {
                let _ = ShowWindow(hwnd, SW_MINIMIZE);
            }
        }
    }
}

#[cfg(target_os = "windows")]
pub fn probe(process_id: Option<u32>) -> HappUiSnapshot {
    windows_impl::probe(process_id)
}

#[cfg(not(target_os = "windows"))]
pub fn probe(_process_id: Option<u32>) -> HappUiSnapshot {
    HappUiSnapshot {
        note: "Happ UI Automation is only available on Windows".to_owned(),
        ..HappUiSnapshot::default()
    }
}

#[cfg(target_os = "windows")]
pub fn toggle_connection(process_id: Option<u32>) -> anyhow::Result<String> {
    windows_impl::toggle_connection(process_id)
}

#[cfg(not(target_os = "windows"))]
pub fn toggle_connection(_process_id: Option<u32>) -> anyhow::Result<String> {
    anyhow::bail!("Happ UI Automation is only available on Windows")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_connect_and_disconnect_actions() {
        assert_eq!(
            classify_connection_action("Connect"),
            Some((ConnectionState::Disconnected, 280))
        );
        assert_eq!(
            classify_connection_action("Отключиться"),
            Some((ConnectionState::Connected, 320))
        );
    }

    #[test]
    fn rejects_ambiguous_connection_labels() {
        assert_eq!(classify_connection_action("Auto connect"), None);
        assert_eq!(classify_connection_action("Connection settings"), None);
        assert_eq!(classify_connection_action("Reconnect"), None);
        assert_eq!(classify_connection_action("Connection"), None);
        assert_eq!(classify_connection_action("Connect to server"), None);
    }

    #[test]
    fn recognizes_transport_labels_only_when_exact() {
        assert_eq!(classify_transport("Proxy"), TransportMode::Proxy);
        assert_eq!(classify_transport("TUN mode"), TransportMode::Tun);
        assert_eq!(classify_transport("Mixed"), TransportMode::Mixed);
        assert_eq!(classify_transport("Proxy settings"), TransportMode::Unknown);
    }
}
