from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8", newline="\n")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old[:120]!r}")
    write(path, content.replace(old, new, 1))


# Settings initial-load retry.
replace_once(
    "src/frontend/src/app/SettingsWindow.tsx",
    '  const [loading, setLoading] = useState(true);\n',
    '  const [loading, setLoading] = useState(true);\n  const [loadAttempt, setLoadAttempt] = useState(0);\n',
)
replace_once(
    "src/frontend/src/app/SettingsWindow.tsx",
    '    const load = async (): Promise<void> => {\n      try {\n',
    '    const load = async (): Promise<void> => {\n      setLoading(true);\n      setLoadError(null);\n      try {\n',
)
replace_once(
    "src/frontend/src/app/SettingsWindow.tsx",
    '  }, [i18n]);\n',
    '  }, [i18n, loadAttempt]);\n',
)
replace_once(
    "src/frontend/src/app/SettingsWindow.tsx",
    '''          <button type="button" className="no-drag rounded-lg border px-3 py-2" onClick={() => void closeSettingsWindow()}>
            {t("common.close")}
          </button>
''',
    '''          <div className="no-drag flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-accent px-3 py-2 font-medium text-white"
              onClick={() => setLoadAttempt((value) => value + 1)}
            >
              {t("actions.retry")}
            </button>
            <button type="button" className="rounded-lg border px-3 py-2" onClick={() => void closeSettingsWindow()}>
              {t("common.close")}
            </button>
          </div>
''',
)

# Happ Setup initial-load retry.
replace_once(
    "src/frontend/src/app/HappSetupWindow.tsx",
    '  const [loading, setLoading] = useState(true);\n',
    '  const [loading, setLoading] = useState(true);\n  const [loadAttempt, setLoadAttempt] = useState(0);\n',
)
replace_once(
    "src/frontend/src/app/HappSetupWindow.tsx",
    '''  useEffect(() => {
    let active = true;
    void getSettings()
''',
    '''  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void getSettings()
''',
)
replace_once(
    "src/frontend/src/app/HappSetupWindow.tsx",
    '  }, [t]);\n',
    '  }, [t, loadAttempt]);\n',
)
replace_once(
    "src/frontend/src/app/HappSetupWindow.tsx",
    '''          <button type="button" className="no-drag rounded-lg border px-3 py-2" onClick={() => void requestClose()}>{t("common.close")}</button>
''',
    '''          <div className="no-drag flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-accent px-3 py-2 font-medium text-white"
              onClick={() => setLoadAttempt((value) => value + 1)}
            >
              {t("actions.retry")}
            </button>
            <button type="button" className="rounded-lg border px-3 py-2" onClick={() => void requestClose()}>
              {t("common.close")}
            </button>
          </div>
''',
)

# Truthful connection state rendering.
replace_once(
    "src/frontend/src/components/connect-button.tsx",
    '''  if (status === "Error") {
    return "error";
  }

  return "off";
''',
    '''  if (status === "Error") {
    return "error";
  }

  if (status === "Disconnected") {
    return "off";
  }

  return "unknown";
''',
)
replace_once(
    "src/frontend/src/locales/en.json",
    '  "connectionButton.connecting": "CONNECTING",\n',
    '  "connectionButton.connecting": "CONNECTING",\n  "connectionButton.unknown": "UNKNOWN",\n',
)
replace_once(
    "src/frontend/src/locales/ru.json",
    '  "connectionButton.connecting": "ПОДКЛ.",\n',
    '  "connectionButton.connecting": "ПОДКЛ.",\n  "connectionButton.unknown": "НЕИЗВ.",\n',
)

write(
    "src/frontend/src/components/connect-button.test.tsx",
    '''// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/lib/i18n";
import { ConnectButton } from "@/components/connect-button";

describe("ConnectButton", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("does not present an unknown state as disconnected", () => {
    render(<ConnectButton status="Unknown" disabled={false} onClick={vi.fn()} />);
    expect(screen.getByText("UNKNOWN")).toBeTruthy();
    expect(screen.queryByText("OFF")).toBeNull();
  });

  it("still presents a confirmed disconnected state as off", () => {
    render(<ConnectButton status="Disconnected" disabled={false} onClick={vi.fn()} />);
    expect(screen.getByText("OFF")).toBeTruthy();
  });
});
''',
)

# Retry regression tests.
replace_once(
    "src/frontend/src/app/SettingsWindow.test.tsx",
    '''  it("shows a save error and keeps the window open when persistence fails", async () => {
''',
    '''  it("retries the complete initial settings load after an error", async () => {
    apiMocks.getSettings.mockRejectedValueOnce(new Error("disk failure"));
    render(<SettingsWindow />);

    expect((await screen.findByRole("alert")).textContent).toContain("Could not load settings");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { name: "Settings" })).not.toBeNull();
    expect(apiMocks.getSettings).toHaveBeenCalledTimes(2);
    expect(apiMocks.getAvailableLocales).toHaveBeenCalledTimes(2);
  });

  it("shows a save error and keeps the window open when persistence fails", async () => {
''',
)
replace_once(
    "src/frontend/src/app/HappSetupWindow.test.tsx",
    '''  it("leaves loading and shows an error when settings cannot load", async () => {
    apiMocks.getSettings.mockRejectedValueOnce(new Error("disk failure"));
    render(<HappSetupWindow />);

    expect((await screen.findByRole("alert")).textContent).toContain("disk failure");
    expect(screen.queryByText("Loading...")).toBeNull();
  });
''',
    '''  it("leaves loading and shows an error when settings cannot load", async () => {
    apiMocks.getSettings.mockRejectedValueOnce(new Error("disk failure"));
    render(<HappSetupWindow />);

    expect((await screen.findByRole("alert")).textContent).toContain("disk failure");
    expect(screen.queryByText("Loading...")).toBeNull();
  });

  it("retries the initial settings load after an error", async () => {
    apiMocks.getSettings.mockRejectedValueOnce(new Error("disk failure"));
    render(<HappSetupWindow />);

    expect((await screen.findByRole("alert")).textContent).toContain("disk failure");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { name: "Happ adapter setup" })).toBeTruthy();
    expect(apiMocks.getSettings).toHaveBeenCalledTimes(2);
  });
''',
)

# Safe window close order and work-area fitting.
replace_once(
    "src/tauri/src/commands/mod.rs",
    '''        settings_store,
''',
    '''        settings_store, window_position,
''',
)
replace_once(
    "src/tauri/src/commands/mod.rs",
    '''    WebviewWindowBuilder::new(&app, "diagnostics", WebviewUrl::External(url))
        .title("Diagnostics")
        .inner_size(1100.0, 780.0)
        .min_inner_size(760.0, 520.0)
        .resizable(true)
        .decorations(true)
        .always_on_top(settings.always_on_top)
        .visible(true)
        .build()
        .map_err(|error| error.to_string())?;

    Ok(())
''',
    '''    let window = WebviewWindowBuilder::new(&app, "diagnostics", WebviewUrl::External(url))
        .title("Diagnostics")
        .inner_size(1100.0, 780.0)
        .min_inner_size(760.0, 520.0)
        .resizable(true)
        .decorations(true)
        .always_on_top(settings.always_on_top)
        .visible(true)
        .build()
        .map_err(|error| error.to_string())?;
    window_position::fit_window_to_current_work_area(&window)?;

    Ok(())
''',
)
replace_once(
    "src/tauri/src/commands/mod.rs",
    '''    window.hide().map_err(|error| error.to_string())?;

    if label != "main" {
        if let Some(main) = app.get_webview_window("main") {
            main.show().map_err(|error| error.to_string())?;
            main.unminimize().map_err(|error| error.to_string())?;
            main.set_focus().map_err(|error| error.to_string())?;
        }
    }

    info!(%label, "window hidden by command");
''',
    '''    if label != "main" {
        let main = app
            .get_webview_window("main")
            .ok_or_else(|| "Window not found: main".to_owned())?;
        main.show().map_err(|error| error.to_string())?;
        main.unminimize().map_err(|error| error.to_string())?;
        window_position::fit_window_to_current_work_area(&main)?;
        main.set_focus().map_err(|error| error.to_string())?;
    }

    // Hide only after the primary window is safely visible. A failed restore must
    // leave the auxiliary surface available instead of making the app disappear.
    window.hide().map_err(|error| error.to_string())?;

    info!(%label, "window hidden by command");
''',
)
replace_once(
    "src/tauri/src/commands/mod.rs",
    '''    window
        .set_size(LogicalSize::new(360.0, clamped as f64))
        .map_err(|error| error.to_string())
''',
    '''    window
        .set_size(LogicalSize::new(360.0, clamped as f64))
        .map_err(|error| error.to_string())?;
    window_position::fit_window_to_current_work_area(&window)?;
    Ok(())
''',
)
replace_once(
    "src/tauri/src/commands/mod.rs",
    '''fn show_window(app: &AppHandle, label: &str) -> Result<(), String> {
''',
    '''pub(crate) fn show_window(app: &AppHandle, label: &str) -> Result<(), String> {
''',
)
replace_once(
    "src/tauri/src/commands/mod.rs",
    '''    window.show().map_err(|error| error.to_string())?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
''',
    '''    window.show().map_err(|error| error.to_string())?;
    window.unminimize().map_err(|error| error.to_string())?;
    window_position::fit_window_to_current_work_area(&window)?;
    window.set_focus().map_err(|error| error.to_string())?;
''',
)

replace_once(
    "src/tauri/src/client_commands.rs",
    '''use crate::{
    adapters::{self, happ, ProxyClientAdapter, RefreshKind},
''',
    '''use crate::{
    adapters::{self, happ, ProxyClientAdapter, RefreshKind},
    commands,
''',
)
replace_once(
    "src/tauri/src/client_commands.rs",
    '''pub async fn open_happ_setup_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("happ-setup")
        .ok_or_else(|| "Happ setup window is not registered".to_owned())?;
    window.show().map_err(|error| error.to_string())?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}
''',
    '''pub async fn open_happ_setup_window(app: AppHandle) -> Result<(), String> {
    commands::show_window(&app, "happ-setup")
}
''',
)

replace_once(
    "src/tauri/src/main.rs",
    '''    if let Err(error) = window.set_focus() {
''',
    '''    if let Err(error) = window_position::fit_window_to_current_work_area(window) {
        warn!(?error, %label, %context, "failed to fit window to current monitor work area");
    }
    if let Err(error) = window.set_focus() {
''',
)
replace_once(
    "src/tauri/src/main.rs",
    '''                    if let Err(error) = window.set_always_on_top(true) {
''',
    '''                    if let Err(error) = window_position::fit_window_to_current_work_area(&window) {
                        warn!(?error, %label, %context, "failed to fit auxiliary window to current monitor work area");
                    }
                    if let Err(error) = window.set_always_on_top(true) {
''',
)

write(
    "src/tauri/src/utils/window_position.rs",
    '''use tauri::{PhysicalPosition, PhysicalSize, Runtime, WebviewWindow};

use crate::models::settings::WindowPosition;

const MIN_VISIBLE_WIDTH: i64 = 80;
const MIN_VISIBLE_HEIGHT: i64 = 48;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ScreenRect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl From<&WindowPosition> for ScreenRect {
    fn from(value: &WindowPosition) -> Self {
        Self {
            x: value.x,
            y: value.y,
            width: value.width,
            height: value.height,
        }
    }
}

pub fn saved_position_has_visible_drag_area(
    saved: &WindowPosition,
    monitors: &[ScreenRect],
) -> bool {
    if saved.width == 0 || saved.height == 0 {
        return false;
    }

    let saved = ScreenRect::from(saved);
    monitors.iter().any(|monitor| {
        let visible_width = intersection_length(
            i64::from(saved.x),
            i64::from(saved.width),
            i64::from(monitor.x),
            i64::from(monitor.width),
        );
        let visible_height = intersection_length(
            i64::from(saved.y),
            i64::from(saved.height),
            i64::from(monitor.y),
            i64::from(monitor.height),
        );

        visible_width >= MIN_VISIBLE_WIDTH && visible_height >= MIN_VISIBLE_HEIGHT
    })
}

pub fn fit_rect_to_work_area(window: ScreenRect, work_area: ScreenRect) -> ScreenRect {
    let available_width = work_area.width.max(1);
    let available_height = work_area.height.max(1);
    let width = window.width.max(1).min(available_width);
    let height = window.height.max(1).min(available_height);

    ScreenRect {
        x: clamp_axis(window.x, width, work_area.x, available_width),
        y: clamp_axis(window.y, height, work_area.y, available_height),
        width,
        height,
    }
}

pub fn fit_window_to_current_work_area<R: Runtime>(
    window: &WebviewWindow<R>,
) -> Result<bool, String> {
    let monitor = match window
        .current_monitor()
        .map_err(|error| format!("Could not resolve current monitor: {error}"))?
    {
        Some(monitor) => monitor,
        None => window
            .primary_monitor()
            .map_err(|error| format!("Could not resolve primary monitor: {error}"))?
            .ok_or_else(|| "No monitor is available for window fitting".to_owned())?,
    };
    let area = monitor.work_area();
    let position = window
        .outer_position()
        .map_err(|error| format!("Could not read window position: {error}"))?;
    let size = window
        .outer_size()
        .map_err(|error| format!("Could not read window size: {error}"))?;
    let fitted = fit_rect_to_work_area(
        ScreenRect {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
        },
        ScreenRect {
            x: area.position.x,
            y: area.position.y,
            width: area.size.width,
            height: area.size.height,
        },
    );

    let size_changed = fitted.width != size.width || fitted.height != size.height;
    let position_changed = fitted.x != position.x || fitted.y != position.y;
    if size_changed {
        window
            .set_size(PhysicalSize::new(fitted.width, fitted.height))
            .map_err(|error| format!("Could not fit window size to work area: {error}"))?;
    }
    if position_changed {
        window
            .set_position(PhysicalPosition::new(fitted.x, fitted.y))
            .map_err(|error| format!("Could not fit window position to work area: {error}"))?;
    }

    Ok(size_changed || position_changed)
}

pub fn restore_or_center<R: Runtime>(
    window: &WebviewWindow<R>,
    saved: &WindowPosition,
) -> Result<bool, String> {
    let monitors = window
        .available_monitors()
        .map_err(|error| format!("Could not enumerate monitors: {error}"))?;
    let monitor_rects = monitors
        .iter()
        .map(|monitor| {
            let area = monitor.work_area();
            ScreenRect {
                x: area.position.x,
                y: area.position.y,
                width: area.size.width,
                height: area.size.height,
            }
        })
        .collect::<Vec<_>>();

    if saved_position_has_visible_drag_area(saved, &monitor_rects) {
        window
            .set_position(PhysicalPosition::new(saved.x, saved.y))
            .map_err(|error| format!("Could not restore saved window position: {error}"))?;
        fit_window_to_current_work_area(window)?;
        Ok(true)
    } else {
        window.center().map_err(|error| {
            format!("Could not center window after invalid saved position: {error}")
        })?;
        fit_window_to_current_work_area(window)?;
        Ok(false)
    }
}

fn clamp_axis(position: i32, size: u32, area_start: i32, area_size: u32) -> i32 {
    let min = i64::from(area_start);
    let max = min
        .saturating_add(i64::from(area_size))
        .saturating_sub(i64::from(size))
        .max(min);
    i64::from(position).clamp(min, max) as i32
}

fn intersection_length(
    first_start: i64,
    first_size: i64,
    second_start: i64,
    second_size: i64,
) -> i64 {
    let first_end = first_start.saturating_add(first_size.max(0));
    let second_end = second_start.saturating_add(second_size.max(0));
    first_end
        .min(second_end)
        .saturating_sub(first_start.max(second_start))
        .max(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn position(x: i32, y: i32) -> WindowPosition {
        WindowPosition {
            x,
            y,
            width: 360,
            height: 500,
        }
    }

    #[test]
    fn accepts_position_with_a_visible_drag_area() {
        let monitors = [ScreenRect {
            x: 0,
            y: 0,
            width: 1920,
            height: 1040,
        }];
        assert!(saved_position_has_visible_drag_area(&position(1500, 700), &monitors));
    }

    #[test]
    fn rejects_window_fully_outside_current_monitors() {
        let monitors = [ScreenRect {
            x: 0,
            y: 0,
            width: 1920,
            height: 1040,
        }];
        assert!(!saved_position_has_visible_drag_area(&position(3000, 200), &monitors));
    }

    #[test]
    fn rejects_tiny_sliver_that_cannot_expose_the_drag_region() {
        let monitors = [ScreenRect {
            x: 0,
            y: 0,
            width: 1920,
            height: 1040,
        }];
        assert!(!saved_position_has_visible_drag_area(&position(1900, 1030), &monitors));
    }

    #[test]
    fn supports_monitors_with_negative_desktop_coordinates() {
        let monitors = [
            ScreenRect { x: -1920, y: 0, width: 1920, height: 1040 },
            ScreenRect { x: 0, y: 0, width: 1920, height: 1040 },
        ];
        assert!(saved_position_has_visible_drag_area(&position(-1200, 200), &monitors));
    }

    #[test]
    fn rejects_zero_sized_corrupt_position() {
        let monitors = [ScreenRect { x: 0, y: 0, width: 1920, height: 1040 }];
        let corrupt = WindowPosition { x: 10, y: 10, width: 0, height: 0 };
        assert!(!saved_position_has_visible_drag_area(&corrupt, &monitors));
    }

    #[test]
    fn shrinks_fixed_window_to_short_work_area_and_keeps_it_visible() {
        let fitted = fit_rect_to_work_area(
            ScreenRect { x: 900, y: 100, width: 500, height: 720 },
            ScreenRect { x: 0, y: 0, width: 1366, height: 700 },
        );
        assert_eq!(fitted, ScreenRect { x: 866, y: 0, width: 500, height: 700 });
    }

    #[test]
    fn clamps_window_inside_negative_coordinate_work_area() {
        let fitted = fit_rect_to_work_area(
            ScreenRect { x: -2100, y: 900, width: 430, height: 760 },
            ScreenRect { x: -1920, y: 0, width: 1920, height: 1040 },
        );
        assert_eq!(fitted, ScreenRect { x: -1920, y: 280, width: 430, height: 760 });
    }
}
''',
)

# Documentation truthfulness and stale audit handoff.
replace_once(
    "README.md",
    '''All four local windows expose explicit loading/error behavior. Settings and Happ Setup protect unsaved draft-only changes on both custom and native close requests. Async Tauri listeners are disposed even if registration finishes after React unmounts. Endpoint lists and loaded settings are normalized and bounded before use.
''',
    '''All four local windows expose explicit loading/error/retry or no-result behavior. Settings and Happ Setup protect unsaved draft-only changes on both custom and native close requests. Auxiliary close requests restore Main before hiding the source window, and every local/diagnostics window is fitted to the active monitor work area when shown or resized. Async Tauri listeners are disposed even if registration finishes after React unmounts. Endpoint lists and loaded settings are normalized and bounded before use.
''',
)
replace_once(
    "project-tracking/tasks/0018-full-project-screen-audit.md",
    '''## Status

Final Verification
''',
    '''## Status

Superseded and completed by the verified follow-up audits 0026-0028.
''',
)
replace_once(
    "project-tracking/reports/0018-full-project-screen-audit-report.md",
    '''## Status

Implementation completed. Final exact-head verification and merge remain pending.
''',
    '''## Status

Historical audit completed; its remaining final-verification bookkeeping was superseded by the verified follow-up audits 0026-0028.
''',
)

print("0028 product audit fixes applied")
