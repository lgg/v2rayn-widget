import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, ClientDescriptor, DashboardStatus } from "@/lib/types";

const apiMocks = vi.hoisted(() => ({
  getClientCatalog: vi.fn(),
  getSettings: vi.fn(),
  getStatus: vi.fn(),
  listSelectedClientItems: vi.fn(),
  openDebugWindow: vi.fn(),
  openDiagnosticsWindow: vi.fn(),
  openSelectedClient: vi.fn(),
  openSettingsWindow: vi.fn(),
  refreshSelectedClient: vi.fn(),
  refreshSelectedClientBackground: vi.fn(),
  refreshSelectedClientPostRoute: vi.fn(),
  refreshSelectedClientStartup: vi.fn(),
  relaunchWidgetAsAdmin: vi.fn(),
  selectClient: vi.fn(),
  selectClientItem: vi.fn(),
  toggleSelectedClient: vi.fn()
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
  window_position: null
};

function descriptor(id: "v2rayn" | "happ", toggle: "supported" | "experimental" | "research_required"): ClientDescriptor {
  return {
    id,
    display_name: id === "v2rayn" ? "v2rayN" : "Happ",
    maturity: "test",
    status_note: "test",
    capabilities: {
      detect_application: "supported",
      read_process_state: "supported",
      read_connection_state: toggle,
      open_application: "supported",
      toggle_connection: toggle,
      list_items: id === "v2rayn" ? "supported" : "research_required",
      select_item: id === "v2rayn" ? "experimental" : "research_required",
      restart_application: "research_required",
      read_transport_mode: "research_required",
      list_subscriptions: "unsupported",
      switch_subscription: "unsupported",
      refresh_subscription: "unsupported",
      manage_subscriptions: "unsupported"
    }
  };
}

function status(updatedAt: string): DashboardStatus {
  return {
    status: "Connected",
    tun_enabled: true,
    connection_state: "Connected",
    active_profile_name: "demo",
    external_ip: null,
    latency_ms: null,
    last_error: null,
    last_event: null,
    updated_at: updatedAt
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

describe("dashboard store refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.listSelectedClientItems.mockResolvedValue([]);
    apiMocks.getClientCatalog.mockResolvedValue([
      descriptor("v2rayn", "supported"),
      descriptor("happ", "research_required")
    ]);
    useDashboardStore.setState({
      status: null,
      settings: baseSettings,
      clients: [descriptor("v2rayn", "supported"), descriptor("happ", "research_required")],
      profiles: [],
      loading: false,
      actionLoading: false,
      error: null,
      notice: null
    });
  });

  it("queues a manual refresh when background refresh is already running", async () => {
    const background = deferred<DashboardStatus>();
    apiMocks.refreshSelectedClientBackground.mockReturnValueOnce(background.promise);
    apiMocks.refreshSelectedClient.mockResolvedValueOnce(status("manual"));

    const backgroundRun = useDashboardStore.getState().refresh({ background: true });
    const manualRun = useDashboardStore.getState().refresh();

    expect(useDashboardStore.getState().actionLoading).toBe(true);
    expect(apiMocks.refreshSelectedClient).not.toHaveBeenCalled();

    background.resolve(status("background"));
    await backgroundRun;
    await manualRun;

    await waitFor(() => {
      expect(apiMocks.refreshSelectedClient).toHaveBeenCalledTimes(1);
    });

    expect(useDashboardStore.getState().status?.updated_at).toBe("manual");
    expect(useDashboardStore.getState().actionLoading).toBe(false);
  });

  it("opens the diagnostics window through the backend command", async () => {
    apiMocks.openDiagnosticsWindow.mockResolvedValue(undefined);

    await useDashboardStore.getState().openDiagnostics();

    expect(apiMocks.openDiagnosticsWindow).toHaveBeenCalledTimes(1);
  });

  it("does not let an old background refresh overwrite a newly selected client", async () => {
    const background = deferred<DashboardStatus>();
    apiMocks.refreshSelectedClientBackground.mockReturnValueOnce(background.promise);
    apiMocks.selectClient.mockResolvedValueOnce({ ...baseSettings, selected_client: "happ" });
    apiMocks.refreshSelectedClientStartup.mockResolvedValueOnce({
      ...status("happ"),
      status: "Disconnected",
      connection_state: "Disconnected",
      tun_enabled: false,
      active_profile_name: null
    });

    const oldRefresh = useDashboardStore.getState().refresh({ background: true });
    await useDashboardStore.getState().selectClient("happ");
    background.resolve(status("old-v2rayn"));
    await oldRefresh;

    expect(useDashboardStore.getState().settings?.selected_client).toBe("happ");
    expect(useDashboardStore.getState().status?.updated_at).toBe("happ");
  });

  it("reloads dynamic capability descriptors after external settings change", async () => {
    apiMocks.getClientCatalog.mockResolvedValueOnce([
      descriptor("v2rayn", "supported"),
      descriptor("happ", "experimental")
    ]);

    useDashboardStore.getState().applyExternalSettings({
      ...baseSettings,
      selected_client: "happ",
      happ_allow_ui_automation: true
    });

    await waitFor(() => {
      expect(useDashboardStore.getState().clients.find((client) => client.id === "happ")?.capabilities.toggle_connection)
        .toBe("experimental");
    });
  });

  it("does not let an older catalog request overwrite newer Happ capabilities", async () => {
    const olderCatalog = deferred<ClientDescriptor[]>();
    const newerCatalog = deferred<ClientDescriptor[]>();
    apiMocks.getClientCatalog
      .mockReturnValueOnce(olderCatalog.promise)
      .mockReturnValueOnce(newerCatalog.promise);

    useDashboardStore.setState({ settings: { ...baseSettings, selected_client: "happ" } });
    useDashboardStore.getState().applyExternalSettings({
      ...baseSettings,
      selected_client: "happ",
      happ_allow_ui_automation: false
    });
    useDashboardStore.getState().applyExternalSettings({
      ...baseSettings,
      selected_client: "happ",
      happ_allow_ui_automation: true
    });

    newerCatalog.resolve([descriptor("v2rayn", "supported"), descriptor("happ", "experimental")]);
    await waitFor(() => {
      expect(useDashboardStore.getState().clients.find((client) => client.id === "happ")?.capabilities.toggle_connection)
        .toBe("experimental");
    });

    olderCatalog.resolve([descriptor("v2rayn", "supported"), descriptor("happ", "research_required")]);
    await Promise.resolve();
    expect(useDashboardStore.getState().clients.find((client) => client.id === "happ")?.capabilities.toggle_connection)
      .toBe("experimental");
  });

});
