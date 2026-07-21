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

fn write_temporary(path: &Path, content: &[u8]) -> Result<PathBuf> {
    let temporary = temporary_path(path);
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

    Ok(temporary)
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

pub fn read_validated_string<F>(path: &Path, is_valid: F) -> Result<String>
where
    F: Fn(&str) -> bool,
{
    recover_backup_if_missing(path)?;

    let primary_result = fs::read_to_string(path);
    if let Ok(content) = &primary_result {
        if is_valid(content) {
            return Ok(content.clone());
        }
    }

    let primary_problem = match &primary_result {
        Ok(_) => format!("Primary file failed validation: {}", path.display()),
        Err(error) => format!("Failed to read primary file {}: {error}", path.display()),
    };
    let backup = backup_path(path);
    let backup_content = fs::read_to_string(&backup).with_context(|| {
        format!(
            "{primary_problem}; failed to read backup {}",
            backup.display()
        )
    })?;
    if !is_valid(&backup_content) {
        return Err(anyhow::anyhow!(
            "{primary_problem}; backup failed validation: {}",
            backup.display()
        ));
    }

    restore_content_without_rotating_backup(path, backup_content.as_bytes()).with_context(
        || {
            format!(
                "{primary_problem}; valid backup could not be restored from {}",
                backup.display()
            )
        },
    )?;

    Ok(backup_content)
}

fn restore_content_without_rotating_backup(path: &Path, content: &[u8]) -> Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| anyhow::anyhow!("Could not resolve parent for {}", path.display()))?;
    fs::create_dir_all(parent)
        .with_context(|| format!("Failed to create directory: {}", parent.display()))?;

    let temporary = write_temporary(path, content)?;
    if path.exists() {
        fs::remove_file(path)
            .with_context(|| format!("Failed to remove invalid file: {}", path.display()))?;
    }

    if let Err(error) = fs::rename(&temporary, path) {
        let _ = fs::remove_file(&temporary);
        return Err(error).with_context(|| {
            format!(
                "Failed to restore {} from temporary file {}",
                path.display(),
                temporary.display()
            )
        });
    }

    Ok(())
}

pub fn replace_with_backup(path: &Path, content: &[u8]) -> Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| anyhow::anyhow!("Could not resolve parent for {}", path.display()))?;
    fs::create_dir_all(parent)
        .with_context(|| format!("Failed to create directory: {}", parent.display()))?;

    let temporary = write_temporary(path, content)?;
    let backup = backup_path(path);

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

    fn temp_file(prefix: &str) -> (PathBuf, PathBuf) {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("{prefix}-{unique}"));
        fs::create_dir_all(&dir).expect("create temp directory");
        let path = dir.join("settings.json");
        (dir, path)
    }

    #[test]
    fn replacement_keeps_the_previous_complete_file_as_backup() {
        let (dir, path) = temp_file("v2rayn-widget-file-store");

        replace_with_backup(&path, b"first").expect("first write");
        replace_with_backup(&path, b"second").expect("second write");

        assert_eq!(fs::read(&path).expect("read current"), b"second");
        assert_eq!(fs::read(backup_path(&path)).expect("read backup"), b"first");
        assert!(!temporary_path(&path).exists());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn missing_current_file_is_recovered_from_backup() {
        let (dir, path) = temp_file("v2rayn-widget-file-recovery");
        fs::write(backup_path(&path), b"recovered").expect("write backup");

        assert!(recover_backup_if_missing(&path).expect("recover"));
        assert_eq!(fs::read(&path).expect("read recovered"), b"recovered");

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn invalid_primary_is_replaced_by_a_valid_backup_without_rotating_it() {
        let (dir, path) = temp_file("v2rayn-widget-file-validation-recovery");
        fs::write(&path, b"broken").expect("write invalid primary");
        fs::write(backup_path(&path), b"valid").expect("write valid backup");

        let content = read_validated_string(&path, |value| value == "valid").expect("recover");

        assert_eq!(content, "valid");
        assert_eq!(fs::read(&path).expect("read restored"), b"valid");
        assert_eq!(
            fs::read(backup_path(&path)).expect("read retained backup"),
            b"valid"
        );

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn invalid_backup_does_not_replace_the_primary_file() {
        let (dir, path) = temp_file("v2rayn-widget-invalid-backup");
        fs::write(&path, b"broken-primary").expect("write invalid primary");
        fs::write(backup_path(&path), b"broken-backup").expect("write invalid backup");

        assert!(read_validated_string(&path, |value| value == "valid").is_err());
        assert_eq!(
            fs::read(&path).expect("read untouched primary"),
            b"broken-primary"
        );

        let _ = fs::remove_dir_all(dir);
    }
}
