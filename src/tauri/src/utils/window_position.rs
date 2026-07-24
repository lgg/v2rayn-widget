use tauri::{PhysicalPosition, PhysicalSize, Runtime, WebviewWindow};

use crate::models::settings::WindowPosition;

const MIN_VISIBLE_WIDTH: i64 = 80;
const MIN_VISIBLE_HEIGHT: i64 = 48;
const MAIN_MIN_INNER_SIZE: (u32, u32) = (360, 270);
const DEBUG_MIN_INNER_SIZE: (u32, u32) = (460, 420);
const DIAGNOSTICS_MIN_INNER_SIZE: (u32, u32) = (760, 520);

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
    let inner_size = window
        .inner_size()
        .map_err(|error| format!("Could not read window client size: {error}"))?;
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

    let maximum_inner_size = inner_size_for_outer_target(
        (size.width, size.height),
        (inner_size.width, inner_size.height),
        (area.size.width.max(1), area.size.height.max(1)),
    );
    if let Some((minimum_width, minimum_height)) =
        constrained_min_inner_size(window.label(), maximum_inner_size)
    {
        window
            .set_min_size(Some(PhysicalSize::new(minimum_width, minimum_height)))
            .map_err(|error| format!("Could not fit window minimum size to work area: {error}"))?;
    }

    let size_changed = fitted.width != size.width || fitted.height != size.height;
    let position_changed = fitted.x != position.x || fitted.y != position.y;
    if size_changed {
        let (target_inner_width, target_inner_height) = inner_size_for_outer_target(
            (size.width, size.height),
            (inner_size.width, inner_size.height),
            (fitted.width, fitted.height),
        );
        window
            .set_size(PhysicalSize::new(target_inner_width, target_inner_height))
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

fn preferred_min_inner_size(label: &str) -> Option<(u32, u32)> {
    match label {
        "main" => Some(MAIN_MIN_INNER_SIZE),
        "debug" => Some(DEBUG_MIN_INNER_SIZE),
        "diagnostics" => Some(DIAGNOSTICS_MIN_INNER_SIZE),
        _ => None,
    }
}

fn constrained_min_inner_size(
    label: &str,
    maximum_inner_size: (u32, u32),
) -> Option<(u32, u32)> {
    preferred_min_inner_size(label).map(|preferred| {
        (
            preferred.0.min(maximum_inner_size.0.max(1)),
            preferred.1.min(maximum_inner_size.1.max(1)),
        )
    })
}

fn inner_size_for_outer_target(
    current_outer: (u32, u32),
    current_inner: (u32, u32),
    target_outer: (u32, u32),
) -> (u32, u32) {
    let frame_width = current_outer.0.saturating_sub(current_inner.0);
    let frame_height = current_outer.1.saturating_sub(current_inner.1);
    (
        target_outer.0.saturating_sub(frame_width).max(1),
        target_outer.1.saturating_sub(frame_height).max(1),
    )
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
        assert!(saved_position_has_visible_drag_area(
            &position(1500, 700),
            &monitors
        ));
    }

    #[test]
    fn rejects_window_fully_outside_current_monitors() {
        let monitors = [ScreenRect {
            x: 0,
            y: 0,
            width: 1920,
            height: 1040,
        }];
        assert!(!saved_position_has_visible_drag_area(
            &position(3000, 200),
            &monitors
        ));
    }

    #[test]
    fn rejects_tiny_sliver_that_cannot_expose_the_drag_region() {
        let monitors = [ScreenRect {
            x: 0,
            y: 0,
            width: 1920,
            height: 1040,
        }];
        assert!(!saved_position_has_visible_drag_area(
            &position(1900, 1030),
            &monitors
        ));
    }

    #[test]
    fn supports_monitors_with_negative_desktop_coordinates() {
        let monitors = [
            ScreenRect {
                x: -1920,
                y: 0,
                width: 1920,
                height: 1040,
            },
            ScreenRect {
                x: 0,
                y: 0,
                width: 1920,
                height: 1040,
            },
        ];
        assert!(saved_position_has_visible_drag_area(
            &position(-1200, 200),
            &monitors
        ));
    }

    #[test]
    fn rejects_zero_sized_corrupt_position() {
        let monitors = [ScreenRect {
            x: 0,
            y: 0,
            width: 1920,
            height: 1040,
        }];
        let corrupt = WindowPosition {
            x: 10,
            y: 10,
            width: 0,
            height: 0,
        };
        assert!(!saved_position_has_visible_drag_area(&corrupt, &monitors));
    }

    #[test]
    fn shrinks_fixed_window_to_short_work_area_and_keeps_it_visible() {
        let fitted = fit_rect_to_work_area(
            ScreenRect {
                x: 900,
                y: 100,
                width: 500,
                height: 720,
            },
            ScreenRect {
                x: 0,
                y: 0,
                width: 1366,
                height: 700,
            },
        );
        assert_eq!(
            fitted,
            ScreenRect {
                x: 866,
                y: 0,
                width: 500,
                height: 700
            }
        );
    }

    #[test]
    fn converts_an_outer_target_to_the_matching_decorated_inner_size() {
        assert_eq!(
            inner_size_for_outer_target((1100, 780), (1084, 741), (900, 700)),
            (884, 661),
        );
    }

    #[test]
    fn caps_native_minimum_to_the_available_inner_work_area() {
        assert_eq!(
            constrained_min_inner_size("debug", (320, 240)),
            Some((320, 240)),
        );
        assert_eq!(
            constrained_min_inner_size("diagnostics", (700, 480)),
            Some((700, 480)),
        );
    }

    #[test]
    fn restores_preferred_native_minimum_when_the_work_area_allows_it() {
        assert_eq!(
            constrained_min_inner_size("main", (1920, 1040)),
            Some(MAIN_MIN_INNER_SIZE),
        );
        assert_eq!(
            constrained_min_inner_size("debug", (1920, 1040)),
            Some(DEBUG_MIN_INNER_SIZE),
        );
        assert_eq!(
            constrained_min_inner_size("diagnostics", (1920, 1040)),
            Some(DIAGNOSTICS_MIN_INNER_SIZE),
        );
    }

    #[test]
    fn does_not_invent_a_minimum_for_unconstrained_fixed_windows() {
        assert_eq!(constrained_min_inner_size("settings", (300, 200)), None);
        assert_eq!(
            constrained_min_inner_size("happ-setup", (300, 200)),
            None
        );
    }

    #[test]
    fn clamps_window_inside_negative_coordinate_work_area() {
        let fitted = fit_rect_to_work_area(
            ScreenRect {
                x: -2100,
                y: 900,
                width: 430,
                height: 760,
            },
            ScreenRect {
                x: -1920,
                y: 0,
                width: 1920,
                height: 1040,
            },
        );
        assert_eq!(
            fitted,
            ScreenRect {
                x: -1920,
                y: 280,
                width: 430,
                height: 760
            }
        );
    }
}
