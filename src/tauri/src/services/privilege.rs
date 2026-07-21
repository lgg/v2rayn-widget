use crate::models::debug::PrivilegeDiagnostics;

#[cfg(target_os = "windows")]
mod windows_impl {
    use anyhow::{anyhow, Context, Result};
    use std::{ffi::OsStr, os::windows::ffi::OsStrExt};
    use sysinfo::{ProcessesToUpdate, System};
    use windows::{
        core::{w, PCWSTR},
        Win32::{
            Foundation::{CloseHandle, HANDLE},
            Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY},
            System::Threading::{
                GetCurrentProcess, OpenProcess, OpenProcessToken, PROCESS_QUERY_LIMITED_INFORMATION,
            },
            UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL},
        },
    };

    use crate::models::debug::PrivilegeDiagnostics;

    pub fn collect_v2rayn_privilege_diagnostics() -> Result<PrivilegeDiagnostics> {
        let widget_is_admin = current_process_is_elevated()?;

        let mut diagnostics = PrivilegeDiagnostics {
            widget_is_admin,
            ..PrivilegeDiagnostics::default()
        };

        if let Some(pid) = find_v2rayn_pid() {
            diagnostics.v2rayn_pid = Some(pid);

            match process_is_elevated(pid) {
                Ok(target_is_admin) => {
                    diagnostics.v2rayn_is_admin = Some(target_is_admin);
                    diagnostics.uipi_mismatch = target_is_admin && !widget_is_admin;
                }
                Err(error) => {
                    // If v2rayN token cannot be read from non-admin widget, treat as potential UIPI mismatch.
                    if !widget_is_admin {
                        diagnostics.uipi_mismatch = true;
                    }
                    tracing::warn!(?error, pid, "could not read v2rayN token elevation");
                }
            }
        }

        Ok(diagnostics)
    }

    pub fn current_process_is_elevated() -> Result<bool> {
        unsafe { token_is_elevated_for_process(GetCurrentProcess()) }
    }

    pub fn process_is_elevated(pid: u32) -> Result<bool> {
        unsafe {
            let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
                .with_context(|| format!("OpenProcess failed for pid {pid}"))?;

            let result = token_is_elevated_for_process(process);
            let _ = CloseHandle(process);
            result
        }
    }

    pub fn relaunch_self_as_admin() -> Result<()> {
        let exe = std::env::current_exe().context("Failed to resolve current executable")?;
        let wide = to_wide(exe.as_os_str());

        let result = unsafe {
            ShellExecuteW(
                None,
                w!("runas"),
                PCWSTR(wide.as_ptr()),
                PCWSTR::null(),
                PCWSTR::null(),
                SW_SHOWNORMAL,
            )
        };

        if result.0 as isize <= 32 {
            return Err(anyhow!(
                "Could not relaunch widget with administrator rights (ShellExecute code {})",
                result.0 as isize
            ));
        }

        Ok(())
    }

    fn find_v2rayn_pid() -> Option<u32> {
        let mut system = System::new_all();
        system.refresh_processes(ProcessesToUpdate::All, true);

        for (pid, process) in system.processes() {
            let name = process.name().to_string_lossy().to_lowercase();
            if name == "v2rayn.exe" || name == "v2rayn" {
                return Some(pid.as_u32());
            }
        }

        None
    }

    unsafe fn token_is_elevated_for_process(process: HANDLE) -> Result<bool> {
        let mut token = HANDLE::default();
        OpenProcessToken(process, TOKEN_QUERY, &mut token).context("OpenProcessToken failed")?;

        let mut elevation = TOKEN_ELEVATION::default();
        let mut out_size: u32 = 0;

        let result = GetTokenInformation(
            token,
            TokenElevation,
            Some((&mut elevation as *mut TOKEN_ELEVATION).cast()),
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut out_size,
        );

        let _ = CloseHandle(token);

        result.context("GetTokenInformation(TokenElevation) failed")?;
        Ok(elevation.TokenIsElevated != 0)
    }

    fn to_wide(value: &OsStr) -> Vec<u16> {
        value.encode_wide().chain(std::iter::once(0)).collect()
    }
}

#[cfg(target_os = "windows")]
pub fn collect_v2rayn_privilege_diagnostics() -> anyhow::Result<PrivilegeDiagnostics> {
    windows_impl::collect_v2rayn_privilege_diagnostics()
}

#[cfg(not(target_os = "windows"))]
pub fn collect_v2rayn_privilege_diagnostics() -> anyhow::Result<PrivilegeDiagnostics> {
    Ok(PrivilegeDiagnostics::default())
}

#[cfg(target_os = "windows")]
pub fn relaunch_self_as_admin() -> anyhow::Result<()> {
    windows_impl::relaunch_self_as_admin()
}

#[cfg(not(target_os = "windows"))]
pub fn relaunch_self_as_admin() -> anyhow::Result<()> {
    Err(anyhow::anyhow!(
        "Relaunch as administrator is only available on Windows"
    ))
}

#[cfg(target_os = "windows")]
pub fn current_process_is_elevated() -> anyhow::Result<bool> {
    windows_impl::current_process_is_elevated()
}

#[cfg(not(target_os = "windows"))]
pub fn current_process_is_elevated() -> anyhow::Result<bool> {
    Ok(false)
}
