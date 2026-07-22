use anyhow::Context;
use tauri::{Runtime, WebviewWindow};

use crate::models::settings::AppSettings;

pub fn apply_window_visuals<R: Runtime>(
    window: &WebviewWindow<R>,
    _settings: &AppSettings,
) -> anyhow::Result<()> {
    window
        .set_shadow(false)
        .context("Failed to disable native window shadow")?;
    window
        .set_decorations(false)
        .context("Failed to disable native window decorations")?;
    Ok(())
}
