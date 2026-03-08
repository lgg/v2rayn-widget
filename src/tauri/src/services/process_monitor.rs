use std::path::{Path, PathBuf};

use sysinfo::{Pid, ProcessesToUpdate, System};

#[derive(Debug, Clone, Default)]
pub struct ProcessSnapshot {
    pub v2rayn_running: bool,
    pub v2rayn_pid: Option<u32>,
    pub core_processes: Vec<String>,
}

pub fn read_process_snapshot() -> ProcessSnapshot {
    let mut system = System::new_all();
    system.refresh_processes(ProcessesToUpdate::All, true);

    let mut snapshot = ProcessSnapshot::default();

    for (pid, process) in system.processes() {
        let process_name = process.name().to_string_lossy().to_lowercase();

        if is_v2rayn_process_name(&process_name) {
            snapshot.v2rayn_running = true;
            snapshot.v2rayn_pid = Some(pid.as_u32());
        }

        let core_matches = ["xray", "v2ray", "sing-box", "mihomo", "clash"];
        if core_matches.iter().any(|entry| process_name.contains(entry)) {
            snapshot.core_processes.push(process_name);
        }
    }

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

    for process in system.processes().values() {
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

        let candidate = parent.to_path_buf();
        if is_valid_v2rayn_base_path(&candidate) {
            return Some(candidate);
        }
    }

    None
}

pub fn terminate_v2rayn() {
    let mut system = System::new_all();
    system.refresh_processes(ProcessesToUpdate::All, true);

    for process in system.processes().values() {
        let process_name = process.name().to_string_lossy().to_lowercase();
        if is_v2rayn_process_name(&process_name) {
            let _ = process.kill();
        }
    }
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
