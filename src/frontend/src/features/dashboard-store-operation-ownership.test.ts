import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, DashboardStatus } from "@/lib/types";

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

const status: DashboardStatus = {
  status: "Connected",
  tun_enabled: true,
  connection_state: "Connected",
  active_profile_name: "demo",
  external_ip: null,
  latency_ms: null,
  last_error: null,
  last_event: null,
  updated_at: "2026-08-01T08:00:00.000Z",
};

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe("dashboard interactive operation ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    apiMocks.getClientCatalog.mockResolvedValue([]);
    apiMocks.listSelectedClientItems.mockResolvedValue([]);
    apiMocks.refreshSelectedClientStartup.mockResolvedValue(status);
    apiMocks.refreshSelectedClientPostRoute.mockResolvedValue(status);
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

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("dispatches only one toggle before the first action settles", async () => {
    const request = deferred<DashboardStatus>();
    apiMocks.toggleSelectedClient.mockReturnValueOnce(request.promise);

    const first = useDashboardStore.getState().toggleConnection();
    const second = useDashboardStore.getState().toggleConnection();

    expect(apiMocks.toggleSelectedClient).toHaveBeenCalledTimes(1);
    expect(useDashboardStore.getState().actionLoading).toBe(true);

    request.resolve(status);
    await Promise.all([first, second]);
    expect(useDashboardStore.getState().actionLoading).toBe(false);
  });

  it("dispatches only one client switch before the first selection settles", async () => {
    const request = deferred<AppSettings>();
    apiMocks.selectClient.mockReturnValueOnce(request.promise);

    const first = useDashboardStore.getState().selectClient("happ");
    const second = useDashboardStore.getState().selectClient("happ");

    expect(apiMocks.selectClient).toHaveBeenCalledTimes(1);
    request.resolve({ ...settings, selected_client: "happ" });
    await Promise.all([first, second]);
    expect(useDashboardStore.getState().settings?.selected_client).toBe("happ");
  });

  it("dispatches only one profile selection before the first selection settles", async () => {
    const request = deferred<DashboardStatus>();
    apiMocks.selectClientItem.mockReturnValueOnce(request.promise);

    const first = useDashboardStore.getState().setActiveItem("profile-1");
    const second = useDashboardStore.getState().setActiveItem("profile-1");

    expect(apiMocks.selectClientItem).toHaveBeenCalledTimes(1);
    request.resolve(status);
    await Promise.all([first, second]);
    expect(useDashboardStore.getState().actionLoading).toBe(false);
  });
});