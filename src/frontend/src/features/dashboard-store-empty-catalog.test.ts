import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, DashboardStatus, ProfileSummary } from "@/lib/types";

const apiMocks = vi.hoisted(() => ({
  getClientCatalog: vi.fn(),
  getSettings: vi.fn(),
  getStatus: vi.fn(),
  listSelectedClientItems: vi.fn(),
  openDebugWindow: vi.fn(),
  openDiagnosticsWindow: vi.fn(),
  openHappSetupWindow: vi.fn(),
  openSelectedClient: vi.fn(),
  openSettingsWindow: vi.fn(),
  refreshSelectedClient: vi.fn(),
  refreshSelectedClientBackground: vi.fn(),
  refreshSelectedClientPostRoute: vi.fn(),
  refreshSelectedClientStartup: vi.fn(),
  relaunchWidgetAsAdmin: vi.fn(),
  selectClient: vi.fn(),
  selectClientItem: vi.fn(),
  toggleSelectedClient: vi.fn(),
}));

vi.mock("@/lib/api", () => apiMocks);

import { useDashboardStore } from "@/features/dashboard-store";

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

const oldProfiles: ProfileSummary[] = [
  { id: "old-profile", name: "Old profile" },
];

function status(updatedAt: string): DashboardStatus {
  return {
    status: "Connected",
    tun_enabled: true,
    connection_state: "Connected",
    active_profile_name: null,
    external_ip: null,
    latency_ms: null,
    last_error: null,
    last_event: null,
    updated_at: updatedAt,
  };
}

describe("post-route empty profile catalogs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useDashboardStore.setState({
      settings,
      status: status("2026-08-03T00:00:00.000Z"),
      clients: [],
      profiles: oldProfiles,
      loading: false,
      actionLoading: false,
      error: null,
      notice: null,
      pathNoticeKey: null,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("clears stale profiles after a toggle when the verified catalog is empty", async () => {
    apiMocks.toggleSelectedClient.mockResolvedValue(
      status("2026-08-03T00:00:01.000Z"),
    );
    apiMocks.refreshSelectedClientPostRoute.mockResolvedValue(
      status("2026-08-03T00:00:02.000Z"),
    );
    apiMocks.listSelectedClientItems.mockResolvedValue([]);

    await useDashboardStore.getState().toggleConnection();
    expect(useDashboardStore.getState().profiles).toEqual(oldProfiles);

    await vi.advanceTimersByTimeAsync(3200);

    expect(useDashboardStore.getState().profiles).toEqual([]);
  });

  it("clears stale profiles after item selection when the later catalog is empty", async () => {
    apiMocks.selectClientItem.mockResolvedValue(
      status("2026-08-03T00:00:01.000Z"),
    );
    apiMocks.refreshSelectedClientPostRoute.mockResolvedValue(
      status("2026-08-03T00:00:02.000Z"),
    );
    apiMocks.listSelectedClientItems
      .mockResolvedValueOnce(oldProfiles)
      .mockResolvedValueOnce([]);

    await useDashboardStore.getState().setActiveItem("old-profile");
    expect(useDashboardStore.getState().profiles).toEqual(oldProfiles);

    await vi.advanceTimersByTimeAsync(5000);

    expect(useDashboardStore.getState().profiles).toEqual([]);
  });
});
