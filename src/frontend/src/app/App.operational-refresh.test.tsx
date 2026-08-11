// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, DashboardStatus } from "@/lib/types";
import "@/lib/i18n";

const apiMocks = vi.hoisted(() => ({
  setMainWindowHeight: vi.fn(),
}));

const storeMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  noop: vi.fn(),
  settings: null as unknown,
  status: null as unknown,
}));

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

const status: DashboardStatus = {
  status: "Unknown",
  tun_enabled: false,
  connection_state: "Unknown",
  active_profile_name: null,
  external_ip: null,
  latency_ms: null,
  last_error: null,
  last_event: null,
  updated_at: "2026-08-11T00:00:00Z",
};

vi.mock("@/lib/api", () => apiMocks);
vi.mock("@/lib/tauri-listener", () => ({
  bindTauriListener: vi.fn(() => () => undefined),
}));
vi.mock("@/features/dashboard-store", () => ({
  useDashboardStore: () => ({
    bootstrap: storeMocks.noop,
    refresh: storeMocks.refresh,
    selectClient: storeMocks.noop,
    toggleConnection: storeMocks.noop,
    setActiveItem: storeMocks.noop,
    status: storeMocks.status,
    settings: storeMocks.settings,
    clients: [],
    profiles: [],
    loading: false,
    actionLoading: false,
    notice: null,
    error: null,
    pathNoticeKey: null,
    openDiagnostics: storeMocks.noop,
    openHappSetup: storeMocks.noop,
    openSettings: storeMocks.noop,
    openClient: storeMocks.noop,
    relaunchAsAdmin: storeMocks.noop,
    showNotice: storeMocks.noop,
    clearNotice: storeMocks.noop,
    applyExternalSettings: storeMocks.noop,
    applyExternalStatus: storeMocks.noop,
    applyExternalOperationError: storeMocks.noop,
  }),
}));

import { App } from "@/app/App";

class ResizeObserverStub {
  observe(): void {}
  disconnect(): void {}
  unobserve(): void {}
}

describe("App operational refresh ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.setMainWindowHeight.mockResolvedValue(undefined);
    storeMocks.settings = baseSettings;
    storeMocks.status = status;
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  it("does not start a second refresh for an explicit client transition", () => {
    const { rerender } = render(<App />);

    storeMocks.settings = { ...baseSettings, selected_client: "happ" };
    rerender(<App />);

    expect(storeMocks.refresh).not.toHaveBeenCalled();
  });

  it("still refreshes when operational settings change on the same client", () => {
    const { rerender } = render(<App />);

    storeMocks.settings = { ...baseSettings, show_latency: false };
    rerender(<App />);

    expect(storeMocks.refresh).toHaveBeenCalledTimes(1);
  });
});
