#[cfg(target_os = "windows")]
use anyhow::Result;
#[cfg(not(target_os = "windows"))]
use anyhow::{anyhow, Result};

use crate::models::debug::UiDebugReport;

#[cfg(target_os = "windows")]
mod windows_impl {
    use anyhow::{anyhow, Result};
    use windows::{
        core::BOOL,
        Win32::{
            Foundation::{HWND, LPARAM, POINT, RECT, RPC_E_CHANGED_MODE, WPARAM},
            Graphics::Gdi::ScreenToClient,
            System::Com::{
                CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
                COINIT_APARTMENTTHREADED,
            },
            UI::{
                Accessibility::{
                    CUIAutomation, IUIAutomation, IUIAutomationElement,
                    IUIAutomationInvokePattern, IUIAutomationLegacyIAccessiblePattern,
                    IUIAutomationSelectionItemPattern, IUIAutomationTogglePattern,
                    TreeScope_Subtree, UIA_ButtonControlTypeId, UIA_CheckBoxControlTypeId,
                    UIA_CustomControlTypeId, UIA_DataItemControlTypeId,
                    UIA_HyperlinkControlTypeId, UIA_InvokePatternId,
                    UIA_LegacyIAccessiblePatternId, UIA_ListItemControlTypeId,
                    UIA_MenuItemControlTypeId, UIA_PaneControlTypeId,
                    UIA_SelectionItemPatternId, UIA_TogglePatternId,
                    UIA_ToolBarControlTypeId, UIA_WindowControlTypeId,
                },
                Input::KeyboardAndMouse::{
                    SendInput, INPUT, INPUT_0, INPUT_MOUSE, MOUSEEVENTF_LEFTDOWN,
                    MOUSEEVENTF_LEFTUP, MOUSEINPUT,
                },
                WindowsAndMessaging::{
                    BM_CLICK, EnumChildWindows, EnumWindows, FindWindowW, GetCursorPos,
                    GetWindowRect, GetWindowTextLengthW, GetWindowTextW,
                    GetWindowThreadProcessId, IsIconic, IsWindowVisible, SW_MINIMIZE,
                    SW_RESTORE, SendMessageW, SetCursorPos, SetForegroundWindow, ShowWindow,
                    WM_KEYDOWN, WM_KEYUP,
                    WM_LBUTTONDOWN, WM_LBUTTONUP,
                },
            },
        },
    };
    use crate::models::debug::{UiAutomationNode, UiDebugReport};

    const MAX_UIA_NODES: usize = 480;
    const MAX_TEXT_ITEMS: usize = 360;

    #[derive(Default)]
    struct WindowSearch {
        best: Option<(HWND, i32)>,
    }

    #[derive(Default)]
    struct ChildScan {
        titles: Vec<String>,
        tun_candidates: Vec<String>,
        first_tun_hwnd: Option<HWND>,
        preferred_tun_hwnd: Option<HWND>,
        preferred_tun_title: Option<String>,
        first_tun_title: Option<String>,
    }

    #[derive(Default)]
    struct UiaScanResult {
        nodes: Vec<UiAutomationNode>,
        tun_candidates: Vec<String>,
        reload_candidates: Vec<String>,
        best_tun: Option<UiActionCandidate>,
        best_reload: Option<UiActionCandidate>,
    }

    #[derive(Clone)]
    struct UiActionCandidate {
        element: IUIAutomationElement,
        label: String,
        score: i32,
    }

    struct ComGuard {
        should_uninit: bool,
    }

    impl ComGuard {
        fn init() -> Result<Self> {
            let hr = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
            if hr == RPC_E_CHANGED_MODE {
                return Ok(Self { should_uninit: false });
            }

            hr.ok()
                .map_err(|error| anyhow!("CoInitializeEx failed: {error}"))?;

            Ok(Self { should_uninit: true })
        }
    }

    impl Drop for ComGuard {
        fn drop(&mut self) {
            if self.should_uninit {
                unsafe {
                    CoUninitialize();
                }
            }
        }
    }

    pub fn toggle_tun_via_ui() -> Result<()> {
        click_enable_tun_via_ui().map(|_| ())
    }

    pub fn click_enable_tun_via_ui() -> Result<String> {
        let hwnd = find_v2rayn_window().ok_or_else(|| anyhow!("v2rayN window not found"))?;
        let was_minimized = bring_target_window_to_front(hwnd);

        let result = (|| -> Result<String> {
            if let Ok(scan) = scan_uia_controls(hwnd) {
                if let Some(candidate) = scan.best_tun {
                    let method = click_element(&candidate.element)?;
                    return Ok(format!(
                        "Clicked Enable Tun via UIA ({method}): {} [score={}]",
                        candidate.label, candidate.score
                    ));
                }
            }

            let child_scan = scan_child_controls(hwnd);
            if let Some(target) = child_scan.preferred_tun_hwnd.or(child_scan.first_tun_hwnd) {
                unsafe {
                    let _ = SendMessageW(target, BM_CLICK, Some(WPARAM(0)), Some(LPARAM(0)));
                }
                return Ok("Sent BM_CLICK to Win32 child TUN candidate".to_owned());
            }

            Err(anyhow!(
                "UI automation could not locate a clickable TUN control. Use Debug Tools probe for details."
            ))
        })();

        restore_window_state_after_action(hwnd, was_minimized);
        result
    }

    pub fn click_reload_via_ui() -> Result<String> {
        let hwnd = find_v2rayn_window().ok_or_else(|| anyhow!("v2rayN window not found"))?;
        let was_minimized = bring_target_window_to_front(hwnd);

        let result = (|| -> Result<String> {
            let scan = scan_uia_controls(hwnd)?;
            let candidate = scan
                .best_reload
                .ok_or_else(|| anyhow!("Reload control was not found in UIA tree"))?;

            let method = click_element(&candidate.element)?;
            Ok(format!(
                "Clicked Reload via UIA ({method}): {} [score={}]",
                candidate.label, candidate.score
            ))
        })();

        restore_window_state_after_action(hwnd, was_minimized);
        result
    }

    pub fn set_active_profile_via_ui(target_profile_name: &str) -> Result<String> {
        let profile_name = target_profile_name.trim();
        if profile_name.is_empty() {
            return Err(anyhow!("Profile name is empty"));
        }

        let hwnd = find_v2rayn_window().ok_or_else(|| anyhow!("v2rayN window not found"))?;
        let was_minimized = bring_target_window_to_front(hwnd);

        let result = (|| -> Result<String> {
            let candidate = find_profile_candidate(hwnd, profile_name)?;

            let select_method = select_element(&candidate.element)
                .unwrap_or("selection_soft_fallback");

            std::thread::sleep(std::time::Duration::from_millis(120));
            let (focus_method, focus_hwnd) = focus_profile_row(&candidate.element, hwnd)
                .unwrap_or(("focus_soft_fallback", hwnd));
            std::thread::sleep(std::time::Duration::from_millis(120));
            send_enter_key(focus_hwnd);
            if focus_hwnd != hwnd {
                std::thread::sleep(std::time::Duration::from_millis(40));
                send_enter_key(hwnd);
            }

            Ok(format!(
                "Selected profile via UIA ({select_method}/{focus_method}), sent Enter on selected row: {} [score={}]",
                candidate.label, candidate.score
            ))
        })();

        restore_window_state_after_action(hwnd, was_minimized);
        result
    }

    pub fn debug_probe() -> Result<UiDebugReport> {
        let hwnd = find_v2rayn_window();

        let Some(window) = hwnd else {
            return Ok(UiDebugReport {
                window_found: false,
                window_title: None,
                window_pid: None,
                window_process_name: None,
                tun_control_found: false,
                tun_control_title: None,
                reload_control_found: false,
                reload_control_title: None,
                child_controls: Vec::new(),
                tun_candidates: Vec::new(),
                reload_candidates: Vec::new(),
                uia_nodes: Vec::new(),
                note: "v2rayN window not found".to_owned(),
                ..UiDebugReport::default()
            });
        };

        let title = get_window_title(window);
        let pid = get_window_pid(window);
        let child_scan = scan_child_controls(window);

        let mut note = "Probe complete".to_owned();

        let uia_scan = match scan_uia_controls(window) {
            Ok(scan) => Some(scan),
            Err(error) => {
                note = format!("Probe complete (UIA scan failed: {error})");
                None
            }
        };

        let tun_candidates = if let Some(scan) = &uia_scan {
            if scan.tun_candidates.is_empty() {
                child_scan.tun_candidates.clone()
            } else {
                scan.tun_candidates.clone()
            }
        } else {
            child_scan.tun_candidates.clone()
        };

        let child_controls = if let Some(scan) = &uia_scan {
            if scan.nodes.is_empty() {
                child_scan.titles.clone()
            } else {
                scan.nodes
                    .iter()
                    .map(|node| {
                        format!(
                            "{} | {}",
                            node.control_type,
                            node.name.clone().unwrap_or_else(|| "-".to_owned())
                        )
                    })
                    .take(MAX_TEXT_ITEMS)
                    .collect()
            }
        } else {
            child_scan.titles.clone()
        };

        Ok(UiDebugReport {
            window_found: true,
            window_title: if title.is_empty() { None } else { Some(title) },
            window_pid: pid,
            window_process_name: None,
            tun_control_found: uia_scan
                .as_ref()
                .and_then(|scan| scan.best_tun.as_ref())
                .is_some()
                || child_scan.preferred_tun_hwnd.is_some()
                || child_scan.first_tun_hwnd.is_some(),
            tun_control_title: uia_scan
                .as_ref()
                .and_then(|scan| scan.best_tun.as_ref())
                .map(|candidate| candidate.label.clone())
                .or(child_scan.preferred_tun_title)
                .or(child_scan.first_tun_title),
            reload_control_found: uia_scan
                .as_ref()
                .and_then(|scan| scan.best_reload.as_ref())
                .is_some(),
            reload_control_title: uia_scan
                .as_ref()
                .and_then(|scan| scan.best_reload.as_ref())
                .map(|candidate| candidate.label.clone()),
            child_controls,
            tun_candidates,
            reload_candidates: uia_scan
                .as_ref()
                .map(|scan| scan.reload_candidates.clone())
                .unwrap_or_default(),
            uia_nodes: uia_scan.map(|scan| scan.nodes).unwrap_or_default(),
            note,
            ..UiDebugReport::default()
        })
    }

    fn scan_uia_controls(parent_hwnd: HWND) -> Result<UiaScanResult> {
        let _com = ComGuard::init()?;
        let automation: IUIAutomation = unsafe {
            CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER)
                .map_err(|error| anyhow!("CoCreateInstance(CUIAutomation) failed: {error}"))?
        };

        let root = unsafe {
            automation
                .ElementFromHandle(parent_hwnd)
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

        let count = unsafe {
            elements
                .Length()
                .map_err(|error| anyhow!("Length() failed: {error}"))?
        };

        let mut result = UiaScanResult::default();

        for index in 0..count {
            let element = unsafe {
                elements
                    .GetElement(index)
                    .map_err(|error| anyhow!("GetElement({index}) failed: {error}"))?
            };

            let name = sanitize_optional(unsafe { element.CurrentName() }.ok().map(|v| v.to_string()));
            let automation_id =
                sanitize_optional(unsafe { element.CurrentAutomationId() }.ok().map(|v| v.to_string()));
            let class_name = sanitize_optional(unsafe { element.CurrentClassName() }.ok().map(|v| v.to_string()));
            let control_type_id = unsafe { element.CurrentControlType() }.ok().map(|value| value.0);
            let control_type = control_type_id
                .map(control_type_label)
                .unwrap_or_else(|| "Unknown".to_owned());

            let bounds = unsafe { element.CurrentBoundingRectangle() }
                .ok()
                .and_then(format_rect_bounds);
            let native_hwnd = unsafe { element.CurrentNativeWindowHandle() }
                .ok()
                .map(|hwnd| hwnd.0 as isize as i64);

            if result.nodes.len() < MAX_UIA_NODES {
                result.nodes.push(UiAutomationNode {
                    name: name.clone(),
                    automation_id: automation_id.clone(),
                    class_name: class_name.clone(),
                    control_type: control_type.clone(),
                    bounds,
                    native_hwnd,
                });
            }

            let haystack = build_haystack(&name, &automation_id, &class_name);

            let tun_score = score_tun_candidate(&haystack, control_type_id);
            if tun_score > 0 {
                let label = format_candidate_label(
                    name.clone(),
                    automation_id.clone(),
                    class_name.clone(),
                    &control_type,
                    tun_score,
                );

                if result.tun_candidates.len() < MAX_TEXT_ITEMS {
                    result.tun_candidates.push(label.clone());
                }

                match &result.best_tun {
                    Some(best) if best.score >= tun_score => {}
                    _ => {
                        result.best_tun = Some(UiActionCandidate {
                            element: element.clone(),
                            label,
                            score: tun_score,
                        });
                    }
                }
            }

            let reload_score = score_reload_candidate(&haystack, control_type_id);
            if reload_score > 0 {
                let label = format_candidate_label(name, automation_id, class_name, &control_type, reload_score);

                if result.reload_candidates.len() < MAX_TEXT_ITEMS {
                    result.reload_candidates.push(label.clone());
                }

                match &result.best_reload {
                    Some(best) if best.score >= reload_score => {}
                    _ => {
                        result.best_reload = Some(UiActionCandidate {
                            element: element,
                            label,
                            score: reload_score,
                        });
                    }
                }
            }
        }

        Ok(result)
    }

    fn find_profile_candidate(parent_hwnd: HWND, target_profile_name: &str) -> Result<UiActionCandidate> {
        let _com = ComGuard::init()?;
        let automation: IUIAutomation = unsafe {
            CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER)
                .map_err(|error| anyhow!("CoCreateInstance(CUIAutomation) failed: {error}"))?
        };

        let root = unsafe {
            automation
                .ElementFromHandle(parent_hwnd)
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

        let count = unsafe {
            elements
                .Length()
                .map_err(|error| anyhow!("Length() failed: {error}"))?
        };

        let target_lower = target_profile_name.trim().to_lowercase();
        let target_tokens = tokenize_profile_name(&target_lower);
        let mut best: Option<UiActionCandidate> = None;
        let mut profile_candidates: Vec<String> = Vec::new();
        let mut window_rect_value = RECT::default();
        let window_rect = unsafe {
            if GetWindowRect(parent_hwnd, &mut window_rect_value).is_ok() {
                Some(window_rect_value)
            } else {
                None
            }
        };

        for index in 0..count {
            let element = unsafe {
                elements
                    .GetElement(index)
                    .map_err(|error| anyhow!("GetElement({index}) failed: {error}"))?
            };

            let name = sanitize_optional(unsafe { element.CurrentName() }.ok().map(|v| v.to_string()));
            let automation_id =
                sanitize_optional(unsafe { element.CurrentAutomationId() }.ok().map(|v| v.to_string()));
            let class_name =
                sanitize_optional(unsafe { element.CurrentClassName() }.ok().map(|v| v.to_string()));
            let control_type_id = unsafe { element.CurrentControlType() }.ok().map(|value| value.0);
            let control_type = control_type_id
                .map(control_type_label)
                .unwrap_or_else(|| "Unknown".to_owned());
            let bounds = unsafe { element.CurrentBoundingRectangle() }.ok();

            let haystack = build_haystack(&name, &automation_id, &class_name);
            let score = score_profile_candidate(
                &haystack,
                &target_lower,
                &target_tokens,
                control_type_id,
                class_name.as_deref(),
                bounds,
                window_rect,
            );
            if score <= 0 {
                continue;
            }

            let label = format_candidate_label(
                name,
                automation_id,
                class_name,
                &control_type,
                score,
            ) + &bounds_suffix(bounds);

            if profile_candidates.len() < MAX_TEXT_ITEMS {
                profile_candidates.push(label.clone());
            }

            match &best {
                Some(current) if current.score >= score => {}
                _ => {
                    best = Some(UiActionCandidate {
                        element,
                        label,
                        score,
                    });
                }
            }
        }

        best.ok_or_else(|| {
            if profile_candidates.is_empty() {
                anyhow!(
                    "No matching UI row found for profile '{target_profile_name}'. Probe UI tree in Debug Tools."
                )
            } else {
                anyhow!(
                    "Profile '{target_profile_name}' was not confidently matched in UI tree. Top candidates: {}",
                    profile_candidates
                        .into_iter()
                        .take(6)
                        .collect::<Vec<_>>()
                        .join(" || ")
                )
            }
        })
    }

    fn select_element(element: &IUIAutomationElement) -> Result<&'static str> {
        unsafe {
            let _ = element.SetFocus();
        }

        if let Ok(pattern) =
            unsafe { element.GetCurrentPatternAs::<IUIAutomationSelectionItemPattern>(UIA_SelectionItemPatternId) }
        {
            if unsafe { pattern.Select() }.is_ok() {
                return Ok("selection_item_pattern");
            }
        }

        if let Ok(pattern) =
            unsafe { element.GetCurrentPatternAs::<IUIAutomationLegacyIAccessiblePattern>(UIA_LegacyIAccessiblePatternId) }
        {
            if unsafe { pattern.Select(3) }.is_ok() {
                return Ok("legacy_select");
            }

            if unsafe { pattern.DoDefaultAction() }.is_ok() {
                return Ok("legacy_default_action_select_fallback");
            }
        }

        click_element(element)
    }

    fn click_element(element: &IUIAutomationElement) -> Result<&'static str> {
        unsafe {
            let _ = element.SetFocus();
        }

        if let Ok(pattern) = unsafe { element.GetCurrentPatternAs::<IUIAutomationTogglePattern>(UIA_TogglePatternId) }
        {
            unsafe {
                pattern
                    .Toggle()
                    .map_err(|error| anyhow!("TogglePattern::Toggle failed: {error}"))?;
            }
            return Ok("toggle_pattern");
        }

        if let Ok(pattern) = unsafe { element.GetCurrentPatternAs::<IUIAutomationInvokePattern>(UIA_InvokePatternId) }
        {
            unsafe {
                pattern
                    .Invoke()
                    .map_err(|error| anyhow!("InvokePattern::Invoke failed: {error}"))?;
            }
            return Ok("invoke_pattern");
        }

        if let Ok(pattern) =
            unsafe { element.GetCurrentPatternAs::<IUIAutomationLegacyIAccessiblePattern>(UIA_LegacyIAccessiblePatternId) }
        {
            if unsafe { pattern.DoDefaultAction() }.is_ok() {
                return Ok("legacy_default_action");
            }
        }

        if let Ok(hwnd) = unsafe { element.CurrentNativeWindowHandle() } {
            if !hwnd.is_invalid() {
                unsafe {
                    let _ = SendMessageW(hwnd, BM_CLICK, Some(WPARAM(0)), Some(LPARAM(0)));
                }
                return Ok("bm_click_fallback");
            }
        }

        Err(anyhow!(
            "No supported invoke/toggle pattern and no native HWND fallback"
        ))
    }

    fn focus_profile_row(element: &IUIAutomationElement, fallback_hwnd: HWND) -> Result<(&'static str, HWND)> {
        let rect = unsafe { element.CurrentBoundingRectangle() }
            .map_err(|error| anyhow!("CurrentBoundingRectangle failed: {error}"))?;

        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        if width <= 0 || height <= 0 {
            return Err(anyhow!("Profile row has invalid bounds"));
        }

        let max_offset_x = (width - 4).max(6);
        let max_offset_y = (height - 4).max(6);
        let offset_x = (width / 4).clamp(6, max_offset_x);
        let offset_y = (height / 2).clamp(6, max_offset_y);

        let click_x = rect.left + offset_x;
        let click_y = rect.top + offset_y;

        let target_hwnd = fallback_hwnd;
        unsafe {
            let _ = SetForegroundWindow(target_hwnd);
        }

        if mouse_left_click_screen(click_x, click_y).is_ok() {
            std::thread::sleep(std::time::Duration::from_millis(110));
            return Ok(("send_input_left_click", target_hwnd));
        }

        // Fallback: message-based click when SendInput path is blocked.
        let (client_x, client_y) = screen_to_client_point(target_hwnd, click_x, click_y);
        unsafe {
            let client_pos = encode_point_lparam(client_x, client_y);
            let _ = SendMessageW(target_hwnd, WM_LBUTTONDOWN, Some(WPARAM(0x0001)), Some(client_pos));
            let _ = SendMessageW(target_hwnd, WM_LBUTTONUP, Some(WPARAM(0)), Some(client_pos));
        }

        std::thread::sleep(std::time::Duration::from_millis(110));
        Ok(("message_left_click_fallback", target_hwnd))
    }

    fn mouse_left_click_screen(x: i32, y: i32) -> Result<()> {
        let mut original = POINT::default();
        unsafe {
            let _ = GetCursorPos(&mut original);
            SetCursorPos(x, y).map_err(|error| anyhow!("SetCursorPos failed: {error}"))?;
        }

        std::thread::sleep(std::time::Duration::from_millis(20));

        let inputs = [
            INPUT {
                r#type: INPUT_MOUSE,
                Anonymous: INPUT_0 {
                    mi: MOUSEINPUT {
                        dx: 0,
                        dy: 0,
                        mouseData: 0,
                        dwFlags: MOUSEEVENTF_LEFTDOWN,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            INPUT {
                r#type: INPUT_MOUSE,
                Anonymous: INPUT_0 {
                    mi: MOUSEINPUT {
                        dx: 0,
                        dy: 0,
                        mouseData: 0,
                        dwFlags: MOUSEEVENTF_LEFTUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
        ];

        let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };

        unsafe {
            let _ = SetCursorPos(original.x, original.y);
        }

        if sent < inputs.len() as u32 {
            return Err(anyhow!(
                "SendInput left-click sent {sent}/{} events",
                inputs.len()
            ));
        }

        Ok(())
    }

    fn encode_point_lparam(x: i32, y: i32) -> LPARAM {
        let packed = ((y as u32) << 16) | (x as u32 & 0xFFFF);
        LPARAM(packed as isize)
    }

    fn send_enter_key(hwnd: HWND) {
        unsafe {
            let _ = SetForegroundWindow(hwnd);
            let _ = SendMessageW(hwnd, WM_KEYDOWN, Some(WPARAM(0x0D)), Some(LPARAM(0)));
            let _ = SendMessageW(hwnd, WM_KEYUP, Some(WPARAM(0x0D)), Some(LPARAM(0)));
        }
    }

    fn build_haystack(name: &Option<String>, automation_id: &Option<String>, class_name: &Option<String>) -> String {
        format!(
            "{} {} {}",
            name.as_deref().unwrap_or_default().to_lowercase(),
            automation_id.as_deref().unwrap_or_default().to_lowercase(),
            class_name.as_deref().unwrap_or_default().to_lowercase()
        )
    }

    fn score_tun_candidate(haystack: &str, control_type_id: Option<i32>) -> i32 {
        if !haystack.contains("tun") {
            return 0;
        }

        let mut score = 30;

        if haystack.contains("enable tun") {
            score += 240;
        }
        if haystack.contains("enabletun") || haystack.contains("tunmode") || haystack.contains("tun mode") {
            score += 180;
        }
        if haystack.contains("switch") || haystack.contains("toggle") {
            score += 80;
        }

        if matches_clickable_control(control_type_id) {
            score += 60;
        }

        score
    }

    fn score_reload_candidate(haystack: &str, control_type_id: Option<i32>) -> i32 {
        let has_reload_token = haystack.contains("reload")
            || haystack.contains("перезаг")
            || haystack.contains("重载")
            || haystack.contains("重新加载");

        if !has_reload_token {
            return 0;
        }

        let mut score = 120;

        if haystack.contains("reload") {
            score += 120;
        }

        if matches_clickable_control(control_type_id) {
            score += 50;
        }

        score
    }

    fn score_profile_candidate(
        haystack: &str,
        target_lower: &str,
        target_tokens: &[String],
        control_type_id: Option<i32>,
        class_name: Option<&str>,
        bounds: Option<RECT>,
        window_rect: Option<RECT>,
    ) -> i32 {
        if target_lower.is_empty() {
            return 0;
        }

        let mut score = 0;
        let class_lower = class_name.unwrap_or_default().to_lowercase();

        if haystack == target_lower {
            score += 600;
        }

        if haystack.contains(target_lower) {
            score += 420;
        }

        for token in target_tokens {
            if token.len() >= 2 && haystack.contains(token) {
                score += 45;
            }
        }

        if matches_profile_row_control(control_type_id) {
            score += 180;
        } else if matches_clickable_control(control_type_id) {
            score += 60;
        }

        if class_lower.contains("datagrid") {
            score += 240;
        }
        if class_lower.contains("cell") || class_lower.contains("row") {
            score += 90;
        }
        if class_lower.contains("status") || class_lower.contains("toolbar") {
            score -= 180;
        }
        if class_lower.contains("text") && !class_lower.contains("datagrid") {
            score -= 120;
        }

        if let Some(rect) = bounds {
            let width = rect.right - rect.left;
            let height = rect.bottom - rect.top;

            if width >= 140 {
                score += 45;
            } else {
                score -= 30;
            }

            if (18..=72).contains(&height) {
                score += 90;
            } else if height > 90 {
                score -= 220;
            }

            if let Some(win_rect) = window_rect {
                let win_height = win_rect.bottom - win_rect.top;
                if win_height > 0 {
                    let relative_top = rect.top - win_rect.top;
                    let top_cutoff = (win_height as f32 * 0.10) as i32;
                    let bottom_cutoff = (win_height as f32 * 0.68) as i32;

                    if relative_top < top_cutoff {
                        score -= 120;
                    }
                    if relative_top > bottom_cutoff {
                        score -= 260;
                    }
                }
            }
        }

        if target_tokens.len() > 1 {
            let token_hits = target_tokens
                .iter()
                .filter(|token| token.len() >= 2 && haystack.contains(token.as_str()))
                .count();

            if token_hits + 1 < target_tokens.len() {
                score -= 120;
            }
        }

        if score < 120 {
            return 0;
        }

        score
    }

    fn bounds_suffix(bounds: Option<RECT>) -> String {
        match bounds.and_then(format_rect_bounds) {
            Some(value) => format!(" | bounds={value}"),
            None => String::new(),
        }
    }

    fn screen_to_client_point(target_hwnd: HWND, screen_x: i32, screen_y: i32) -> (i32, i32) {
        let mut point = POINT {
            x: screen_x,
            y: screen_y,
        };

        let converted = unsafe { ScreenToClient(target_hwnd, &mut point) }.as_bool();
        if converted {
            return (point.x, point.y);
        }

        let mut target_rect = RECT::default();
        unsafe {
            if GetWindowRect(target_hwnd, &mut target_rect).is_ok() {
                (screen_x - target_rect.left, screen_y - target_rect.top)
            } else {
                (screen_x, screen_y)
            }
        }
    }

    fn tokenize_profile_name(value: &str) -> Vec<String> {
        value
            .split(|ch: char| !ch.is_alphanumeric())
            .filter(|chunk| !chunk.is_empty())
            .map(|chunk| chunk.to_lowercase())
            .collect()
    }

    fn matches_profile_row_control(control_type_id: Option<i32>) -> bool {
        let Some(id) = control_type_id else {
            return false;
        };

        id == UIA_DataItemControlTypeId.0
            || id == UIA_ListItemControlTypeId.0
            || id == UIA_CustomControlTypeId.0
            || id == UIA_PaneControlTypeId.0
    }

    fn matches_clickable_control(control_type_id: Option<i32>) -> bool {
        let Some(id) = control_type_id else {
            return false;
        };

        id == UIA_ButtonControlTypeId.0
            || id == UIA_CheckBoxControlTypeId.0
            || id == UIA_MenuItemControlTypeId.0
            || id == UIA_CustomControlTypeId.0
            || id == UIA_HyperlinkControlTypeId.0
            || id == UIA_ListItemControlTypeId.0
            || id == UIA_DataItemControlTypeId.0
            || id == UIA_ToolBarControlTypeId.0
    }

    fn format_candidate_label(
        name: Option<String>,
        automation_id: Option<String>,
        class_name: Option<String>,
        control_type: &str,
        score: i32,
    ) -> String {
        let shown_name = name.unwrap_or_else(|| "-".to_owned());
        let shown_id = automation_id.unwrap_or_else(|| "-".to_owned());
        let shown_class = class_name.unwrap_or_else(|| "-".to_owned());

        format!(
            "{shown_name} | id={shown_id} | class={shown_class} | type={control_type} | score={score}"
        )
    }

    fn sanitize_optional(value: Option<String>) -> Option<String> {
        value
            .map(|raw| raw.trim().to_owned())
            .filter(|raw| !raw.is_empty())
    }

    fn format_rect_bounds(rect: RECT) -> Option<String> {
        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        if width <= 0 || height <= 0 {
            return None;
        }

        Some(format!(
            "x={}, y={}, w={}, h={}",
            rect.left, rect.top, width, height
        ))
    }

    fn control_type_label(control_type_id: i32) -> String {
        if control_type_id == UIA_ButtonControlTypeId.0 {
            return "Button".to_owned();
        }
        if control_type_id == UIA_CheckBoxControlTypeId.0 {
            return "CheckBox".to_owned();
        }
        if control_type_id == UIA_MenuItemControlTypeId.0 {
            return "MenuItem".to_owned();
        }
        if control_type_id == UIA_WindowControlTypeId.0 {
            return "Window".to_owned();
        }
        if control_type_id == UIA_CustomControlTypeId.0 {
            return "Custom".to_owned();
        }
        if control_type_id == UIA_PaneControlTypeId.0 {
            return "Pane".to_owned();
        }
        if control_type_id == UIA_ListItemControlTypeId.0 {
            return "ListItem".to_owned();
        }
        if control_type_id == UIA_DataItemControlTypeId.0 {
            return "DataItem".to_owned();
        }
        if control_type_id == UIA_HyperlinkControlTypeId.0 {
            return "Hyperlink".to_owned();
        }
        if control_type_id == UIA_ToolBarControlTypeId.0 {
            return "Toolbar".to_owned();
        }

        format!("ControlType({control_type_id})")
    }

    fn bring_target_window_to_front(hwnd: HWND) -> bool {
        let was_minimized = unsafe { IsIconic(hwnd).as_bool() };

        unsafe {
            let _ = ShowWindow(hwnd, SW_RESTORE);
            let _ = SetForegroundWindow(hwnd);
        }

        was_minimized
    }

    fn restore_window_state_after_action(hwnd: HWND, was_minimized: bool) {
        if !was_minimized {
            return;
        }

        unsafe {
            let _ = ShowWindow(hwnd, SW_MINIMIZE);
        }
    }

    fn find_v2rayn_window() -> Option<HWND> {
        let exact = unsafe { FindWindowW(None, windows::core::w!("v2rayN")).ok() };
        if let Some(hwnd) = exact {
            if !hwnd.is_invalid() {
                let title = get_window_title(hwnd).to_lowercase();
                if !title.contains("widget") {
                    return Some(hwnd);
                }
            }
        }

        let mut state = WindowSearch { best: None };

        unsafe {
            let _ = EnumWindows(
                Some(enum_windows_proc),
                LPARAM((&mut state as *mut WindowSearch).cast::<()>() as isize),
            );
        }

        state.best.map(|value| value.0)
    }

    unsafe extern "system" fn enum_windows_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        if !IsWindowVisible(hwnd).as_bool() {
            return BOOL(1);
        }

        let title = get_window_title(hwnd);
        let lower = title.to_lowercase();
        if lower.is_empty() || !lower.contains("v2rayn") || lower.contains("widget") {
            return BOOL(1);
        }

        let score = if lower == "v2rayn" {
            120
        } else if lower.starts_with("v2rayn") {
            90
        } else {
            70
        };

        let search = &mut *(lparam.0 as *mut WindowSearch);
        let should_update = match search.best {
            Some((_, old_score)) => score > old_score,
            None => true,
        };

        if should_update {
            search.best = Some((hwnd, score));
        }

        BOOL(1)
    }

    fn scan_child_controls(parent: HWND) -> ChildScan {
        let mut scan = ChildScan::default();

        unsafe {
            let _ = EnumChildWindows(
                Some(parent),
                Some(enum_child_proc),
                LPARAM((&mut scan as *mut ChildScan).cast::<()>() as isize),
            );
        }

        scan
    }

    unsafe extern "system" fn enum_child_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let scan = &mut *(lparam.0 as *mut ChildScan);

        let title = get_window_title(hwnd);
        let normalized = title.trim().to_owned();

        if !normalized.is_empty() {
            if scan.titles.len() < MAX_TEXT_ITEMS {
                scan.titles.push(normalized.clone());
            }

            let lower = normalized.to_lowercase();
            if lower.contains("tun") {
                if scan.first_tun_hwnd.is_none() {
                    scan.first_tun_hwnd = Some(hwnd);
                    scan.first_tun_title = Some(normalized.clone());
                }

                scan.tun_candidates.push(normalized.clone());

                if lower.contains("enable") {
                    scan.preferred_tun_hwnd = Some(hwnd);
                    scan.preferred_tun_title = Some(normalized);
                }
            }
        }

        BOOL(1)
    }

    fn get_window_title(hwnd: HWND) -> String {
        let len = unsafe { GetWindowTextLengthW(hwnd) };
        if len <= 0 {
            return String::new();
        }

        let mut buf = vec![0_u16; (len + 1) as usize];
        let copied = unsafe { GetWindowTextW(hwnd, &mut buf) };
        if copied <= 0 {
            return String::new();
        }

        String::from_utf16_lossy(&buf[..copied as usize])
    }

    fn get_window_pid(hwnd: HWND) -> Option<u32> {
        let mut pid = 0_u32;
        unsafe {
            let _ = GetWindowThreadProcessId(hwnd, Some(&mut pid));
        }
        if pid == 0 {
            None
        } else {
            Some(pid)
        }
    }
}

#[cfg(target_os = "windows")]
pub fn toggle_tun_via_ui() -> Result<()> {
    windows_impl::toggle_tun_via_ui()
}

#[cfg(not(target_os = "windows"))]
pub fn toggle_tun_via_ui() -> Result<()> {
    Err(anyhow!("UI automation is only available on Windows"))
}

#[cfg(target_os = "windows")]
pub fn click_reload_via_ui() -> Result<String> {
    windows_impl::click_reload_via_ui()
}

#[cfg(not(target_os = "windows"))]
pub fn click_reload_via_ui() -> Result<String> {
    Err(anyhow!("UI automation is only available on Windows"))
}

#[cfg(target_os = "windows")]
pub fn set_active_profile_via_ui(profile_name: &str) -> Result<String> {
    windows_impl::set_active_profile_via_ui(profile_name)
}

#[cfg(not(target_os = "windows"))]
pub fn set_active_profile_via_ui(_profile_name: &str) -> Result<String> {
    Err(anyhow!("UI automation is only available on Windows"))
}

#[cfg(target_os = "windows")]
pub fn debug_probe() -> Result<UiDebugReport> {
    windows_impl::debug_probe()
}

#[cfg(not(target_os = "windows"))]
pub fn debug_probe() -> Result<UiDebugReport> {
    Ok(UiDebugReport {
        window_found: false,
        note: "UI automation diagnostics are only available on Windows".to_owned(),
        ..UiDebugReport::default()
    })
}

#[cfg(target_os = "windows")]
pub fn debug_toggle_via_ui_only() -> Result<String> {
    windows_impl::click_enable_tun_via_ui()
}

#[cfg(not(target_os = "windows"))]
pub fn debug_toggle_via_ui_only() -> Result<String> {
    Err(anyhow!("UI automation is only available on Windows"))
}

#[cfg(target_os = "windows")]
pub fn debug_click_reload_via_ui_only() -> Result<String> {
    windows_impl::click_reload_via_ui()
}

#[cfg(not(target_os = "windows"))]
pub fn debug_click_reload_via_ui_only() -> Result<String> {
    Err(anyhow!("UI automation is only available on Windows"))
}









#[cfg(target_os = "windows")]
pub fn debug_select_profile_via_ui_only(profile_name: &str) -> Result<String> {
    windows_impl::set_active_profile_via_ui(profile_name)
}

#[cfg(not(target_os = "windows"))]
pub fn debug_select_profile_via_ui_only(_profile_name: &str) -> Result<String> {
    Err(anyhow!("UI automation is only available on Windows"))
}





















