use std::path::{Path, PathBuf};

use anyhow::Result;

pub fn app_data_dir() -> Result<PathBuf> {
    let config_dir =
        dirs::config_dir().ok_or_else(|| anyhow::anyhow!("Unable to resolve config directory"))?;
    Ok(config_dir.join("v2rayn-widget"))
}

pub fn settings_file_path() -> Result<PathBuf> {
    Ok(app_data_dir()?.join("settings.json"))
}

pub fn log_dir_path() -> Result<PathBuf> {
    Ok(app_data_dir()?.join("logs"))
}

pub fn detect_v2rayn_path() -> Option<PathBuf> {
    let mut candidates = Vec::<PathBuf>::new();

    if let Some(program_files) = std::env::var_os("ProgramFiles") {
        candidates.push(PathBuf::from(program_files).join("v2rayN"));
    }

    if let Some(program_files_x86) = std::env::var_os("ProgramFiles(x86)") {
        candidates.push(PathBuf::from(program_files_x86).join("v2rayN"));
    }

    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        candidates.push(
            PathBuf::from(local_app_data)
                .join("Programs")
                .join("v2rayN"),
        );
    }

    if let Some(user_profile) = std::env::var_os("USERPROFILE") {
        candidates.push(PathBuf::from(user_profile).join("Downloads").join("v2rayN"));
    }

    candidates
        .into_iter()
        .find(|candidate| is_valid_v2rayn_path(candidate))
}

pub fn is_valid_v2rayn_path(path: &Path) -> bool {
    path.exists()
        && path.join("guiConfigs").exists()
        && path.join("guiLogs").exists()
        && path.join("v2rayN.exe").exists()
}
