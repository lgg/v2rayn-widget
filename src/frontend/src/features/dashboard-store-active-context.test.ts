import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AppSettings,
  ClientDescriptor,
  DashboardStatus,
} from "@/lib/types";

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

const baseSettings: AppSettings = {
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

function descriptor(id: "v2rayn" | "happ"): ClientDescriptor {
  return {
    id,
    display_name: id === "v2rayn" ? "v2rayN" : "Happ",
    maturity: "test",
    status_note: "test",
    capabilities: {
      detect_application: "supported",
      read_process_state: "supported",
      read_connection_state: "supported",
      open_application: "supported",
      toggle_connection: "supported",
      list_items: id === "v2rayn" ? "supported" : "research_required",
      select_item: id === "v2rayn" ? "experimental" : "research_required",
      restart_application: "research_required",
      read_transport_mode: "research_required",
      list_subscriptions: "unsupported",
      switch_subscription: "unsupported",
      refresh_subscription: "unsupported",
      manage_subscriptions: "unsupported",
    },
  };
}

function connectedStatus(updatedAt: string): DashboardStatus {
  return {
    status: "Connected",
    tun_enabled: true,
    connection_state: "Connected",
    active_profile_name: "demo",
    external_ip: null,
    latency_ms: null,
    last_error: null,
    last_event: null,
    updated_at: updatedAt,
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("dashboard active-client context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    apiMocks.getClientCatalog.mockResolvedValue([
      descriptor("v2rayn"),
      descriptor("happ"),
    ]);
    apiMocks.listSelectedClientItems.mockResolvedValue([]);
    useDashboardStore.setState({
      status: connectedStatus("initial"),
      settings: baseSettings,
      clients: [descriptor("v2rayn"), descriptor("happ")],
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

  it("keeps an in-flight v2rayN action current when inactive Happ settings change", async () => {
    const toggle = deferred<DashboardStatus>();
    apiMocks.toggleSelectedClient.mockReturnValueOnce(toggle.promise);

    const action = useDashboardStore.getState().toggleConnection();
    expect(useDashboardStore.getState().actionLoading).toBe(true);

    useDashboardStore.getState().applyExternalSettings({
      ...baseSettings,
      happ_path: "C:\\Apps\\Happ\\Happ.exe",
      happ_allow_ui_automation: true,
    });

    expect(useDashboardStore.getState().actionLoading).toBe(true);
    expect(useDashboardStore.getState().status?.updated_at).toBe("initial");

    toggle.resolve(connectedStatus("v2rayn-toggle"));
    await action;

    expect(useDashboardStore.getState().status?.updated_at).toBe("v2rayn-toggle");
    expect(useDashboardStore.getState().actionLoading).toBe(false);
  });

  it("keeps an in-flight Happ action current when inactive v2rayN and mock settings change", async () => {
    const happSettings = { ...baseSettings, selected_client: "happ" as const };
    useDashboardStore.setState({
      settings: happSettings,
      status: connectedStatus("happ-initial"),
    });
    const toggle = deferred<DashboardStatus>();
    apiMocks.toggleSelectedClient.mockReturnValueOnce(toggle.promise);

    const action = useDashboardStore.getState().toggleConnection();
    useDashboardStore.getState().applyExternalSettings({
      ...happSettings,
      v2rayn_path_mode: "manual",
      v2rayn_path: "C:\\Apps\\v2rayN",
      mock_mode_enabled: true,
    });

    expect(useDashboardStore.getState().actionLoading).toBe(true);
    expect(useDashboardStore.getState().status?.updated_at).toBe("happ-initial");

    toggle.resolve(connectedStatus("happ-toggle"));
    await action;

    expect(useDashboardStore.getState().status?.updated_at).toBe("happ-toggle");
    expect(useDashboardStore.getState().actionLoading).toBe(false);
  });
});
