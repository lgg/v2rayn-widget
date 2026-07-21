use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

use anyhow::{Context, Result};

fn backup_path(path: &Path) -> PathBuf {
    let mut value = path.as_os_str().to_os_string();
    value.push(".bak");
    PathBuf::from(value)
}

fn temporary_path(path: &Path) -> PathBuf {
    let mut value = path.as_os_str().to_os_string();
    value.push(".tmp");
    PathBuf::from(value)
}

pub fn recover_backup_if_missing(path: &Path) -> Result<bool> {
    if path.exists() {
        return Ok(false);
    }

    let backup = backup_path(path);
    if !backup.exists() {
        return Ok(false);
    }

    fs::rename(&backup, path).with_context(|| {
        format!(
            "Failed to restore backup {} to {}",
            backup.display(),
            path.display()
        )
    })?;
    Ok(true)
}

pub fn replace_with_backup(path: &Path, content: &[u8]) -> Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| anyhow::anyhow!("Could not resolve parent for {}", path.display()))?;
    fs::create_dir_all(parent)
        .with_context(|| format!("Failed to create directory: {}", parent.display()))?;

    let temporary = temporary_path(path);
    let backup = backup_path(path);
    let _ = fs::remove_file(&temporary);

    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary)
        .with_context(|| format!("Failed to create temporary file: {}", temporary.display()))?;
    file.write_all(content)
        .with_context(|| format!("Failed to write temporary file: {}", temporary.display()))?;
    file.sync_all()
        .with_context(|| format!("Failed to flush temporary file: {}", temporary.display()))?;
    drop(file);

    let had_original = path.exists();
    if had_original {
        let _ = fs::remove_file(&backup);
        fs::rename(path, &backup).with_context(|| {
            format!(
                "Failed to move current file {} to backup {}",
                path.display(),
                backup.display()
            )
        })?;
    }

    if let Err(error) = fs::rename(&temporary, path) {
        if had_original && backup.exists() && !path.exists() {
            let _ = fs::rename(&backup, path);
        }
        let _ = fs::remove_file(&temporary);
        return Err(error).with_context(|| {
            format!(
                "Failed to replace {} with temporary file {}",
                path.display(),
                temporary.display()
            )
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn replacement_keeps_the_previous_complete_file_as_backup() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("v2rayn-widget-file-store-{unique}"));
        fs::create_dir_all(&dir).expect("create temp directory");
        let path = dir.join("settings.json");

        replace_with_backup(&path, b"first").expect("first write");
        replace_with_backup(&path, b"second").expect("second write");

        assert_eq!(fs::read(&path).expect("read current"), b"second");
        assert_eq!(fs::read(backup_path(&path)).expect("read backup"), b"first");
        assert!(!temporary_path(&path).exists());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn missing_current_file_is_recovered_from_backup() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("v2rayn-widget-file-recovery-{unique}"));
        fs::create_dir_all(&dir).expect("create temp directory");
        let path = dir.join("settings.json");
        fs::write(backup_path(&path), b"recovered").expect("write backup");

        assert!(recover_backup_if_missing(&path).expect("recover"));
        assert_eq!(fs::read(&path).expect("read recovered"), b"recovered");

        let _ = fs::remove_dir_all(dir);
    }
}
