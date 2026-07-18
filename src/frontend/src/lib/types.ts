export type StatusLevel = "Connected" | "Disconnected" | "Error" | "Unknown" | "Connecting";

export interface DashboardStatus {
  status: StatusLevel;
  tun_enabled: boolean;
  connection_state: StatusLevel;
  active_profile_name: string | null;
  external_ip: string | null;
  latency_ms: number | null;
  last_error: string | null;
  last_event: string | null;
  updated_at: string;
}

export type ProxyClientId = "v2rayn" | "happ";
export type CapabilityState = "supported" | "experimental" | "unsupported" | "research_required";

export interface ClientCapabilities {
  detect_application: CapabilityState;
  read_process_state: CapabilityState;
  read_connection_state: CapabilityState;
  open_application: CapabilityState;
  toggle_connection: CapabilityState;
  list_items: CapabilityState;
  select_item: CapabilityState;
  restart_application: CapabilityState;
  read_transport_mode: CapabilityState;
  list_subscriptions: CapabilityState;
  switch_subscription: CapabilityState;
  refresh_subscription: CapabilityState;
  manage_subscriptions: CapabilityState;
}

export interface ClientDescriptor {
  id: ProxyClientId;
  display_name: string;
  maturity: string;
  status_note: string;
  capabilities: ClientCapabilities;
}

export type ThemeMode = "light" | "dark";
export type PathMode = "auto" | "manual";
export type TimeFormat = "system" | "24h" | "12h";
export type LatencyMode = "active" | "log_snapshot";

export interface WindowPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppSettings {
  selected_client: ProxyClientId;
  language: string;
  theme: ThemeMode;
  always_on_top: boolean;
  autostart_with_windows: boolean;
  allow_restart_fallback: boolean;
  poll_interval_sec: number;
  time_format: TimeFormat;
  show_clock: boolean;
  show_info_status: boolean;
  show_external_ip: boolean;
  show_latency: boolean;
  mock_mode_enabled: boolean;
  show_action_buttons: boolean;
  show_profile_selector: boolean;
  window_effect_enabled: boolean;
  window_opacity_percent: number;
  diagnostics_enabled: boolean;
  diagnostics_url: string;
  latency_mode: LatencyMode;
  connectivity_endpoints: string[];
  ip_endpoints: string[];
  v2rayn_path_mode: PathMode;
  v2rayn_path: string | null;
  happ_path: string | null;
  window_position: WindowPosition | null;
}

export interface UiSettingsPatch {
  language?: string;
  theme?: ThemeMode;
  always_on_top?: boolean;
  time_format?: TimeFormat;
  show_clock?: boolean;
  show_info_status?: boolean;
  show_external_ip?: boolean;
  show_latency?: boolean;
  mock_mode_enabled?: boolean;
  show_action_buttons?: boolean;
  show_profile_selector?: boolean;
  window_effect_enabled?: boolean;
  window_opacity_percent?: number;
}

export interface PathValidation {
  is_valid: boolean;
  message_key: string;
  normalized_path: string;
}

export interface LocaleInfo {
  code: string;
  label: string;
  native_label: string;
}

export interface ProfileSummary {
  id: string;
  name: string;
}

export interface UiNoticeAction {
  type: "relaunch_admin";
  label: string;
}

export interface UiNotice {
  id: number;
  kind: "error" | "info";
  message: string;
  action?: UiNoticeAction;
}

export interface PrivilegeDiagnostics {
  widget_is_admin: boolean;
  v2rayn_pid: number | null;
  v2rayn_is_admin: boolean | null;
  uipi_mismatch: boolean;
}

export interface UiAutomationNode {
  name: string | null;
  automation_id: string | null;
  class_name: string | null;
  control_type: string;
  bounds: string | null;
  native_hwnd: number | null;
}

export interface DebugRuntimeSnapshot {
  enable_tun: boolean | null;
  active_profile_name: string | null;
  v2rayn_running: boolean;
  v2rayn_pid: number | null;
  last_event: string | null;
  last_error: string | null;
}

export interface UiDebugReport {
  window_found: boolean;
  window_title: string | null;
  window_pid: number | null;
  window_process_name: string | null;
  tun_control_found: boolean;
  tun_control_title: string | null;
  reload_control_found: boolean;
  reload_control_title: string | null;
  child_controls: string[];
  tun_candidates: string[];
  reload_candidates: string[];
  uia_nodes: UiAutomationNode[];
  privilege: PrivilegeDiagnostics;
  note: string;
}
