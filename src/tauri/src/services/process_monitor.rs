use std::path::{Path, PathBuf};

use anyhow::{anyhow, Result};
use sysinfo::{Pid, ProcessesToUpdate, System};

#[derive(Debug, Clone, Default)]
pub struct ProcessSnapshot {
    pub v2rayn_running: bool,
    pub v2rayn_pid: Option<u32>,
    pub core_processes: Vec<String>,
}

pub fn read_process_snapshot_for_base_path(base_path: Option<&Path>) -> ProcessSnapshot {
    let mut system = System::new_all();
    system.refresh_processes(ProcessesToUpdate::All, true);

    let expected = base_path.map(normalize_path);
    let mut snapshot = ProcessSnapshot::default();
    let mut matching_pids = Vec::new();

    for (pid, process) in system.processes() {
        let process_name = process.name().to_string_lossy().to_lowercase();

        if is_v2rayn_process_name(&process_name) {
            let path_matches = expected.as_ref().is_none_or(|expected_path| {
                process
                    .exe()
                    .and_then(Path::parent)
                    .is_some_and(|parent| normalize_path(parent) == *expected_path)
            });
            if path_matches {
                matching_pids.push(pid.as_u32());
            }
        }

        let core_matches = ["xray", "v2ray", "sing-box", "mihomo", "clash"];
        if core_matches
            .iter()
            .any(|entry| process_name.contains(entry))
        {
            snapshot.core_processes.push(process_name);
        }
    }

    matching_pids.sort_unstable();
    snapshot.v2rayn_pid = matching_pids.first().copied();
    snapshot.v2rayn_running = snapshot.v2rayn_pid.is_some();
    snapshot.core_processes.sort();
    snapshot.core_processes.dedup();
    snapshot
}

pub fn process_name_by_pid(pid: u32) -> Option<String> {
    let mut system = System::new_all();
    system.refresh_processes(ProcessesToUpdate::All, true);

    let target = Pid::from_u32(pid);
    system
        .process(target)
        .map(|process| process.name().to_string_lossy().to_string())
}

pub fn v2rayn_base_path_from_running_process() -> Option<PathBuf> {
    let mut system = System::new_all();
    system.refresh_processes(ProcessesToUpdate::All, true);

    let mut candidates = system
        .processes()
        .iter()
        .filter_map(|(pid, process)| {
            let process_name = process.name().to_string_lossy().to_lowercase();
            if !is_v2rayn_process_name(&process_name) {
                return None;
            }
            let candidate = process.exe()?.parent()?.to_path_buf();
            is_valid_v2rayn_base_path(&candidate).then_some((pid.as_u32(), candidate))
        })
        .collect::<Vec<_>>();
    candidates.sort_by_key(|(pid, _)| *pid);
    candidates.into_iter().next().map(|(_, path)| path)
}

pub fn terminate_v2rayn_at_path(base_path: &Path) -> Result<bool> {
    let mut system = System::new_all();
    system.refresh_processes(ProcessesToUpdate::All, true);

    let expected = normalize_path(base_path);
    let mut matched = false;

    for (pid, process) in system.processes() {
        let process_name = process.name().to_string_lossy().to_lowercase();
        if !is_v2rayn_process_name(&process_name) {
            continue;
        }

        let Some(exe) = process.exe() else {
            continue;
        };
        let Some(parent) = exe.parent() else {
            continue;
        };

        if normalize_path(parent) == expected {
            matched = true;
            if !process.kill() {
                return Err(anyhow!(
                    "Failed to request termination for matched v2rayN process {}",
                    pid.as_u32()
                ));
            }
        }
    }

    Ok(matched)
}

fn is_v2rayn_process_name(name: &str) -> bool {
    name == "v2rayn.exe" || name == "v2rayn"
}

fn is_valid_v2rayn_base_path(path: &Path) -> bool {
    path.exists()
        && path.join("guiConfigs").exists()
        && path.join("guiLogs").exists()
        && path.join("v2rayN.exe").exists()
}

fn normalize_path(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn path_normalization_matches_equivalent_existing_directories() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let base = std::env::temp_dir().join(format!("v2rayn-widget-process-path-{unique}"));
        fs::create_dir_all(&base).expect("create path");
        let dotted = base.join(".");

        assert_eq!(normalize_path(&base), normalize_path(&dotted));
        let _ = fs::remove_dir_all(base);
    }
}
