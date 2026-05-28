import { invoke } from "@tauri-apps/api/core";
import type {
  AppSettings,
  DashboardStatus,
  DebugRuntimeSnapshot,
  LocaleInfo,
  PathValidation,
  ProfileSummary,
  UiDebugReport,
  UiSettingsPatch
} from "@/lib/types";

export async function getStatus(): Promise<DashboardStatus> {
  return invoke<DashboardStatus>("get_status");
}

export async function refreshStatus(): Promise<DashboardStatus> {
  return invoke<DashboardStatus>("refresh_status");
}

export async function refreshStatusPostRoute(): Promise<DashboardStatus> {
  return invoke<DashboardStatus>("refresh_status_post_route");
}

export async function refreshStatusBackground(): Promise<DashboardStatus> {
  return invoke<DashboardStatus>("refresh_status_background");
}

export async function refreshStatusStartup(): Promise<DashboardStatus> {
  return invoke<DashboardStatus>("refresh_status_startup");
}

export async function toggleTunViaUi(): Promise<DashboardStatus> {
  return invoke<DashboardStatus>("toggle_tun_via_ui");
}

export async function setActiveProfile(profileId: string): Promise<DashboardStatus> {
  return invoke<DashboardStatus>("set_active_profile", { profileId });
}

export async function openV2RayN(): Promise<void> {
  return invoke("open_v2rayn");
}

export async function restartV2RayN(): Promise<void> {
  return invoke("restart_v2rayn");
}

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function updateSettings(payload: AppSettings): Promise<AppSettings> {
  return invoke<AppSettings>("update_settings", { payload });
}

export async function applyUiSettings(payload: UiSettingsPatch): Promise<AppSettings> {
  return invoke<AppSettings>("apply_ui_settings", { payload });
}

export async function openSettingsWindow(): Promise<void> {
  return invoke("open_settings_window");
}

export async function openDebugWindow(): Promise<void> {
  return invoke("open_debug_window");
}

export async function runUiDebugProbe(): Promise<UiDebugReport> {
  return invoke<UiDebugReport>("run_ui_debug_probe");
}

export async function debugToggleViaUiOnly(): Promise<string> {
  return invoke<string>("debug_toggle_via_ui_only");
}

export async function debugClickReloadViaUi(): Promise<string> {
  return invoke<string>("debug_click_reload_via_ui");
}

export async function debugSelectProfileViaUi(profileName: string): Promise<string> {
  return invoke<string>("debug_select_profile_via_ui", { profileName });
}

export async function debugCaptureRuntimeSnapshot(): Promise<DebugRuntimeSnapshot> {
  return invoke<DebugRuntimeSnapshot>("debug_capture_runtime_snapshot");
}

export async function debugToggleViaConfigOnly(): Promise<string> {
  return invoke<string>("debug_toggle_via_config_only");
}

export async function relaunchWidgetAsAdmin(): Promise<void> {
  return invoke("relaunch_widget_as_admin");
}

export async function closeWindow(label: string): Promise<void> {
  return invoke("close_window", { label });
}

export async function detectV2RayNPath(): Promise<string | null> {
  return invoke<string | null>("detect_v2rayn_path");
}

export async function validateV2RayNPath(path: string): Promise<PathValidation> {
  return invoke<PathValidation>("validate_v2rayn_path", { path });
}

export async function getAvailableLocales(): Promise<LocaleInfo[]> {
  return invoke<LocaleInfo[]>("get_available_locales");
}

export async function listProfiles(): Promise<ProfileSummary[]> {
  return invoke<ProfileSummary[]>("list_profiles");
}

export async function exitApp(): Promise<void> {
  return invoke("exit_app");
}

export async function setMainWindowHeight(height: number): Promise<void> {
  return invoke("set_main_window_height", { height });
}

