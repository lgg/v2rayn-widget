use crate::models::settings::AppSettings;

use tauri::{Runtime, WebviewWindow};

pub fn apply_window_visuals<R: Runtime>(
    window: &WebviewWindow<R>,
    _settings: &AppSettings,
) -> anyhow::Result<()> {
    let _ = window.set_shadow(false);
    let _ = window.set_decorations(false);
    Ok(())
}
