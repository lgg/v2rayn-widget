import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, DashboardStatus } from "@/lib/types";

const apiMocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => apiMocks);
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));

import { useDashboardStore } from "@/features/dashboard-store";
import i18n from "@/lib/i18n";

const settings: AppSettings = {
  selected_client: "v2rayn",
  language: "en",
  theme: "dark",
  always_on_top: false,
  autostart_with_windows: false,
  allow_restart_fallback: false,
  poll_interval_sec: 10,
  time_format: "24h",
  show_clock: true,
  show_info_status: true,
  show_external_ip: true,
  show_latency: true,
  mock_mode_enabled: false,
  show_action_buttons: true,
  show_profile_selector: true,
  window_effect_enabled: true,
  window_opacity_percent: 92,
  diagnostics_enabled: false,
  diagnostics_url: "https://ipleak.net/",
  latency_mode: "active",
  connectivity_endpoints: [],
  ip_endpoints: [],
  v2rayn_path_mode: "auto",
  v2rayn_path: null,
  happ_path: null,
  happ_allow_ui_automation: false,
  window_position: null,
};

const status: DashboardStatus = {
  status: "Connected",
  tun_enabled: true,
  connection_state: "Connected",
  active_profile_name: "demo",
  external_ip: null,
  latency_ms: null,
  last_error: null,
  last_event: null,
  updated_at: "2026-08-03T00:00:00.000Z",
};

describe("dashboard command error handling", () => {
  beforeEach(async () => {
    apiMocks.invoke.mockReset();
    await i18n.changeLanguage("en");
    useDashboardStore.setState({
      status,
      settings,
      clients: [],
      profiles: [],
      loading: false,
      actionLoading: false,
      error: null,
      notice: null,
      pathNoticeKey: null,
    });
  });

  it("retains UIPI details and exposes the administrator recovery action", async () => {
    apiMocks.invoke.mockRejectedValueOnce(
      "UIPI_MISMATCH: widget and v2rayN privilege levels differ",
    );

    await useDashboardStore.getState().toggleConnection();

    expect(useDashboardStore.getState().notice).toMatchObject({
      kind: "error",
      action: { type: "relaunch_admin" },
    });
    expect(useDashboardStore.getState().actionLoading).toBe(false);
  });
});
