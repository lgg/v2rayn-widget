// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, DebugRuntimeSnapshot, UiDebugReport } from "@/lib/types";
import i18n from "@/lib/i18n";

const listenerMocks = vi.hoisted(() => ({ bindTauriListener: vi.fn() }));
const apiMocks = vi.hoisted(() => ({
  closeWindow: vi.fn(),
  debugCaptureRuntimeSnapshot: vi.fn(),
  debugClickReloadViaUi: vi.fn(),
  debugSelectProfileViaUi: vi.fn(),
  debugToggleViaConfigOnly: vi.fn(),
  debugToggleViaUiOnly: vi.fn(),
  getSettings: vi.fn(),
  openV2RayN: vi.fn(),
  refreshStatus: vi.fn(),
  relaunchWidgetAsAdmin: vi.fn(),
  runUiDebugProbe: vi.fn(),
  toggleTunViaUi: vi.fn(),
}));

vi.mock("@/lib/api", () => apiMocks);
vi.mock("@/lib/tauri-listener", () => listenerMocks);

import { DebugWindow } from "@/app/DebugWindow";

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

const snapshot: DebugRuntimeSnapshot = {
  enable_tun: false,
  active_profile_name: null,
  v2rayn_running: false,
  v2rayn_pid: null,
  last_event: null,
  last_error: null,
};

const report: UiDebugReport = {
  window_found: false,
  window_title: null,
  window_pid: null,
  window_process_name: null,
  tun_control_found: false,
  tun_control_title: null,
  reload_control_found: false,
  reload_control_title: null,
  child_controls: [],
  tun_candidates: [],
  reload_candidates: [],
  uia_nodes: [],
  privilege: {
    widget_is_admin: false,
    v2rayn_pid: null,
    v2rayn_is_admin: null,
    uipi_mismatch: false,
  },
  note: "Probe complete",
};

describe("DebugWindow settings recovery", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("en");
    listenerMocks.bindTauriListener.mockImplementation((_eventName: string, _handler: unknown, _onError?: unknown, onReady?: () => void) => {
      onReady?.();
      return () => undefined;
    });
    apiMocks.closeWindow.mockResolvedValue(true);
    apiMocks.debugCaptureRuntimeSnapshot.mockResolvedValue(snapshot);
    apiMocks.runUiDebugProbe.mockResolvedValue(report);
  });

  it("shows a localized error and retries instead of remaining in loading forever", async () => {
    apiMocks.getSettings
      .mockRejectedValueOnce(new Error("disk failure"))
      .mockResolvedValueOnce(settings);

    await act(async () => {
      render(<DebugWindow />);
      await Promise.resolve();
    });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Could not load settings");
    expect(screen.queryByText("Loading...")).toBeNull();
    expect((screen.getByRole("button", { name: "Open v2rayN" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(apiMocks.getSettings).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(apiMocks.runUiDebugProbe).toHaveBeenCalledOnce());
    expect(screen.queryByText("Could not load settings")).toBeNull();
    expect((screen.getByRole("button", { name: "Open v2rayN" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
