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

function descriptor(id: "v2rayn" | "happ", maturity = "test"): ClientDescriptor {
  return {
    id,
    display_name: id === "v2rayn" ? "v2rayN" : "Happ",
    maturity,
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

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return { promise, resolve, reject };
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
    apiMocks.refreshSelectedClientStartup.mockResolvedValue(
      connectedStatus("startup"),
    );
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

  it("rejects an older inactive-adapter catalog response", async () => {
    const older = deferred<ClientDescriptor[]>();
    const newer = deferred<ClientDescriptor[]>();
    apiMocks.getClientCatalog
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);

    useDashboardStore.getState().applyExternalSettings({
      ...baseSettings,
      happ_path: "C:\\Apps\\Happ\\Happ.exe",
    });
    useDashboardStore.getState().applyExternalSettings({
      ...baseSettings,
      happ_path: "C:\\Apps\\Happ\\Happ.exe",
      happ_allow_ui_automation: true,
    });

    newer.resolve([descriptor("v2rayn"), descriptor("happ", "new")]);
    await Promise.resolve();
    expect(
      useDashboardStore.getState().clients.find((client) => client.id === "happ")
        ?.maturity,
    ).toBe("new");

    older.resolve([descriptor("v2rayn"), descriptor("happ", "old")]);
    await Promise.resolve();
    expect(
      useDashboardStore.getState().clients.find((client) => client.id === "happ")
        ?.maturity,
    ).toBe("new");
  });

  it("does not overwrite newer settings when client selection finishes", async () => {
    const startup = deferred<DashboardStatus>();
    apiMocks.selectClient.mockResolvedValueOnce({
      ...baseSettings,
      selected_client: "happ",
    });
    apiMocks.refreshSelectedClientStartup.mockReturnValueOnce(startup.promise);

    const selection = useDashboardStore.getState().selectClient("happ");
    await Promise.resolve();
    useDashboardStore.getState().applyExternalSettings({
      ...baseSettings,
      selected_client: "happ",
      show_clock: false,
    });

    startup.resolve(connectedStatus("happ-startup"));
    await selection;

    expect(useDashboardStore.getState().settings?.selected_client).toBe("happ");
    expect(useDashboardStore.getState().settings?.show_clock).toBe(false);
  });

  it("keeps a newer tray status over an older in-flight frontend refresh", async () => {
    const request = deferred<DashboardStatus>();
    apiMocks.refreshSelectedClient.mockReturnValueOnce(request.promise);

    const refresh = useDashboardStore.getState().refresh();
    useDashboardStore.getState().applyExternalStatus({
      client_id: "v2rayn",
      status: connectedStatus("2026-07-31T00:00:02.000Z"),
    });

    request.resolve(connectedStatus("2026-07-31T00:00:01.000Z"));
    await refresh;

    expect(useDashboardStore.getState().status?.updated_at).toBe(
      "2026-07-31T00:00:02.000Z",
    );
    expect(useDashboardStore.getState().actionLoading).toBe(false);
  });

  it("keeps bootstrap status and profiles atomic when its response is stale", async () => {
    useDashboardStore.setState({
      status: connectedStatus("2026-07-31T00:00:04.000Z"),
      profiles: [{ id: "fresh", name: "fresh-profile" }],
    });
    apiMocks.getSettings.mockResolvedValueOnce(baseSettings);
    apiMocks.refreshSelectedClientStartup.mockResolvedValueOnce(
      connectedStatus("2026-07-31T00:00:03.000Z"),
    );
    apiMocks.listSelectedClientItems.mockResolvedValueOnce([
      { id: "stale", name: "stale-profile" },
    ]);

    await useDashboardStore.getState().bootstrap();

    expect(useDashboardStore.getState().status?.updated_at).toBe(
      "2026-07-31T00:00:04.000Z",
    );
    expect(useDashboardStore.getState().profiles).toEqual([
      { id: "fresh", name: "fresh-profile" },
    ]);
  });

  it("ignores inactive-client tray status and errors", () => {
    useDashboardStore.getState().applyExternalStatus({
      client_id: "happ",
      status: connectedStatus("2026-07-31T00:00:03.000Z"),
    });
    expect(useDashboardStore.getState().status?.updated_at).toBe("initial");

    useDashboardStore.getState().applyExternalOperationError({
      client_id: "happ",
      operation: "open_client",
      message: "stale Happ error",
    });
    expect(useDashboardStore.getState().notice).toBeNull();

    useDashboardStore.getState().applyExternalOperationError({
      client_id: "v2rayn",
      operation: "open_client",
      message: "open failed from tray",
    });
    expect(useDashboardStore.getState().notice?.message).toBe(
      "open failed from tray",
    );
  });

  it("rolls back only the selected client after a failed switch", async () => {
    const request = deferred<AppSettings>();
    apiMocks.selectClient.mockReturnValueOnce(request.promise);

    const selection = useDashboardStore.getState().selectClient("happ");
    useDashboardStore.getState().applyExternalSettings({
      ...baseSettings,
      selected_client: "happ",
      show_clock: false,
      diagnostics_enabled: true,
    });
    request.reject(new Error("selection failed"));
    await selection;

    expect(useDashboardStore.getState().settings?.selected_client).toBe("v2rayn");
    expect(useDashboardStore.getState().settings?.show_clock).toBe(false);
    expect(useDashboardStore.getState().settings?.diagnostics_enabled).toBe(true);
  });
});
