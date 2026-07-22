#[cfg(not(target_os = "windows"))]
use anyhow::{anyhow, Result};
#[cfg(target_os = "windows")]
use anyhow::{Context, Result};

#[cfg(target_os = "windows")]
use winreg::{enums::HKEY_CURRENT_USER, RegKey};

const RUN_REG_PATH: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const VALUE_NAME: &str = "v2rayn-widget";

#[cfg(target_os = "windows")]
pub fn apply_autostart(enable: bool) -> Result<()> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hkcu
        .create_subkey(RUN_REG_PATH)
        .context("Failed to open Windows Run registry key")?;

    if enable {
        let exe = std::env::current_exe().context("Failed to resolve current executable path")?;
        let command = format!("\"{}\"", exe.display());
        key.set_value(VALUE_NAME, &command)
            .context("Failed to set autostart registry value")?;
    } else {
        match key.delete_value(VALUE_NAME) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                return Err(error).context("Failed to remove autostart registry value");
            }
        }
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn apply_autostart(_enable: bool) -> Result<()> {
    Err(anyhow!("Autostart is only supported on Windows"))
}
