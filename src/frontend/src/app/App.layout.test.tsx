// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, DashboardStatus } from "@/lib/types";
import "@/lib/i18n";

const apiMocks = vi.hoisted(() => ({
  setMainWindowHeight: vi.fn(),
}));

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
  diagnostics_enabled: true,
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
  updated_at: "2026-07-24T00:00:00Z",
};

vi.mock("@/lib/api", () => apiMocks);
vi.mock("@/lib/tauri-listener", () => ({ bindTauriListener: vi.fn(() => () => undefined) }));
vi.mock("@/features/dashboard-store", () => ({
  useDashboardStore: () => ({
    bootstrap: vi.fn(),
    refresh: vi.fn(),
    selectClient: vi.fn(),
    toggleConnection: vi.fn(),
    setActiveItem: vi.fn(),
    status,
    settings,
    clients: [],
    profiles: [],
    loading: false,
    actionLoading: false,
    notice: null,
    error: null,
    pathNoticeKey: null,
    openDiagnostics: vi.fn(),
    openHappSetup: vi.fn(),
    openSettings: vi.fn(),
    openClient: vi.fn(),
    relaunchAsAdmin: vi.fn(),
    showNotice: vi.fn(),
    clearNotice: vi.fn(),
    applyExternalSettings: vi.fn(),
  }),
}));

import { App } from "@/app/App";

class ResizeObserverStub {
  observe(): void {}
  disconnect(): void {}
  unobserve(): void {}
}

describe("App constrained layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.setMainWindowHeight.mockResolvedValue(undefined);
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  it("keeps the populated dashboard vertically scrollable when the native window is constrained", () => {
    const { container } = render(<App />);
    const main = container.querySelector("main");

    expect(main).not.toBeNull();
    expect(main?.className).toContain("overflow-y-auto");
    expect(main?.className).not.toContain("overflow-hidden");
  });
});
