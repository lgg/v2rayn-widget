use tauri::{PhysicalPosition, Runtime, WebviewWindow};

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

pub fn restore_or_center<R: Runtime>(
    window: &WebviewWindow<R>,
    saved: &WindowPosition,
) -> Result<bool, String> {
    let monitors = window
        .available_monitors()
        .map_err(|error| format!("Could not enumerate monitors: {error}"))?;
    let monitor_rects = monitors
        .iter()
        .map(|monitor| ScreenRect {
            x: monitor.position().x,
            y: monitor.position().y,
            width: monitor.size().width,
            height: monitor.size().height,
        })
        .collect::<Vec<_>>();

    if saved_position_has_visible_drag_area(saved, &monitor_rects) {
        window
            .set_position(PhysicalPosition::new(saved.x, saved.y))
            .map_err(|error| format!("Could not restore saved window position: {error}"))?;
        Ok(true)
    } else {
        window
            .center()
            .map_err(|error| format!("Could not center window after invalid saved position: {error}"))?;
        Ok(false)
    }
}

fn intersection_length(first_start: i64, first_size: i64, second_start: i64, second_size: i64) -> i64 {
    let first_end = first_start.saturating_add(first_size.max(0));
    let second_end = second_start.saturating_add(second_size.max(0));
    first_end.min(second_end).saturating_sub(first_start.max(second_start)).max(0)
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
            height: 1080,
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
            height: 1080,
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
            height: 1080,
        }];

        assert!(!saved_position_has_visible_drag_area(
            &position(1900, 1050),
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
                height: 1080,
            },
            ScreenRect {
                x: 0,
                y: 0,
                width: 1920,
                height: 1080,
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
            height: 1080,
        }];
        let corrupt = WindowPosition {
            x: 10,
            y: 10,
            width: 0,
            height: 0,
        };

        assert!(!saved_position_has_visible_drag_area(&corrupt, &monitors));
    }
}
