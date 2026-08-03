use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager};
use tracing::{info, warn};

use crate::{commands, utils::window_position};

const DRAFT_SURFACE_SETTLE_TIMEOUT: Duration = Duration::from_millis(750);
const DRAFT_SURFACE_POLL_INTERVAL: Duration = Duration::from_millis(50);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct DraftSurface {
    label: &'static str,
    close_event: &'static str,
}

const DRAFT_SURFACES: [DraftSurface; 2] = [
    DraftSurface {
        label: "settings",
        close_event: "settings-close-requested",
    },
    DraftSurface {
        label: "happ-setup",
        close_event: "happ-setup-close-requested",
    },
];

fn all_surfaces_hidden(visible: &[bool]) -> bool {
    visible.iter().all(|value| !value)
}

fn visible_draft_surfaces(app: &AppHandle) -> Result<Vec<DraftSurface>, String> {
    let mut visible = Vec::new();

    for surface in DRAFT_SURFACES {
        let Some(window) = app.get_webview_window(surface.label) else {
            continue;
        };
        if window.is_visible().map_err(|error| error.to_string())? {
            visible.push(surface);
        }
    }

    Ok(visible)
}

async fn prepare_draft_surfaces_for_app_action(app: &AppHandle) -> Result<bool, String> {
    let surfaces = visible_draft_surfaces(app)?;
    if surfaces.is_empty() {
        return Ok(true);
    }

    for surface in &surfaces {
        let window = app
            .get_webview_window(surface.label)
            .ok_or_else(|| format!("Window not found: {}", surface.label))?;
        window.show().map_err(|error| error.to_string())?;
        window.unminimize().map_err(|error| error.to_string())?;
        window_position::fit_window_to_current_work_area(&window)?;
        window.set_focus().map_err(|error| error.to_string())?;
        window
            .emit(surface.close_event, ())
            .map_err(|error| error.to_string())?;
    }

    let deadline = Instant::now() + DRAFT_SURFACE_SETTLE_TIMEOUT;
    loop {
        let mut states = Vec::with_capacity(surfaces.len());
        for surface in &surfaces {
            let visible = match app.get_webview_window(surface.label) {
                Some(window) => window.is_visible().map_err(|error| error.to_string())?,
                None => false,
            };
            states.push(visible);
        }

        if all_surfaces_hidden(&states) {
            return Ok(true);
        }
        if Instant::now() >= deadline {
            info!(
                labels = ?surfaces.iter().map(|surface| surface.label).collect::<Vec<_>>(),
                "application action paused because a draft surface remained visible"
            );
            return Ok(false);
        }

        tokio::time::sleep(DRAFT_SURFACE_POLL_INTERVAL).await;
    }
}

async fn guarded_exit(app: AppHandle) -> Result<(), String> {
    if prepare_draft_surfaces_for_app_action(&app).await? {
        commands::exit_app(app).await
    } else {
        Ok(())
    }
}

pub(crate) fn request_exit_app_from_native(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        if let Err(error) = guarded_exit(app).await {
            warn!(%error, "guarded native application exit failed");
        }
    });
}

#[tauri::command]
pub async fn request_exit_app(app: AppHandle) -> Result<(), String> {
    guarded_exit(app).await
}

#[tauri::command]
pub async fn request_relaunch_widget_as_admin(app: AppHandle) -> Result<(), String> {
    if prepare_draft_surfaces_for_app_action(&app).await? {
        commands::relaunch_widget_as_admin(app).await
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn destructive_actions_require_every_draft_surface_to_be_hidden() {
        assert!(all_surfaces_hidden(&[]));
        assert!(all_surfaces_hidden(&[false, false]));
        assert!(!all_surfaces_hidden(&[true, false]));
        assert!(!all_surfaces_hidden(&[false, true]));
    }

    #[test]
    fn draft_surface_contract_matches_existing_safe_close_events() {
        assert_eq!(DRAFT_SURFACES[0].label, "settings");
        assert_eq!(DRAFT_SURFACES[0].close_event, "settings-close-requested");
        assert_eq!(DRAFT_SURFACES[1].label, "happ-setup");
        assert_eq!(DRAFT_SURFACES[1].close_event, "happ-setup-close-requested");
    }
}
