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
  v2rayn_running: true,
  v2rayn_pid: 123,
  last_event: null,
  last_error: null,
};

const report: UiDebugReport = {
  window_found: true,
  window_title: "v2rayN",
  window_pid: 123,
  window_process_name: "v2rayN.exe",
  tun_control_found: true,
  tun_control_title: "Enable Tun",
  reload_control_found: true,
  reload_control_title: "Reload",
  child_controls: [],
  tun_candidates: [],
  reload_candidates: [],
  uia_nodes: [],
  privilege: {
    widget_is_admin: false,
    v2rayn_pid: 123,
    v2rayn_is_admin: false,
    uipi_mismatch: false,
  },
  note: "Probe complete",
};

describe("DebugWindow operation ownership", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("en");
    listenerMocks.bindTauriListener.mockImplementation((_eventName: string, _handler: unknown, _onError?: unknown, onReady?: () => void) => {
      onReady?.();
      return () => undefined;
    });
    apiMocks.closeWindow.mockResolvedValue(true);
    apiMocks.getSettings.mockResolvedValue(settings);
    apiMocks.debugCaptureRuntimeSnapshot.mockResolvedValue(snapshot);
    apiMocks.runUiDebugProbe.mockResolvedValue(report);
  });

  it("rejects rapid duplicate mutation and defers native close until it settles", async () => {
    let nativeCloseHandler: (() => void) | undefined;
    let resolveToggle!: (value: string) => void;
    listenerMocks.bindTauriListener.mockImplementation((eventName: string, handler: () => void, _onError?: unknown, onReady?: () => void) => {
      if (eventName === "debug-close-requested") nativeCloseHandler = handler;
      onReady?.();
      return () => undefined;
    });
    apiMocks.debugToggleViaUiOnly.mockImplementationOnce(
      () => new Promise<string>((resolve) => { resolveToggle = resolve; }),
    );

    await act(async () => {
      render(<DebugWindow />);
      await Promise.resolve();
    });
    await screen.findByRole("heading", { name: "v2rayN Debug Tools" });
    await waitFor(() => expect(apiMocks.runUiDebugProbe).toHaveBeenCalledOnce());
    await waitFor(() => expect((screen.getByRole("button", { name: "Click Enable Tun" }) as HTMLButtonElement).disabled).toBe(false));

    const toggle = screen.getByRole("button", { name: "Click Enable Tun" });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    await waitFor(() => expect(apiMocks.debugToggleViaUiOnly).toHaveBeenCalledOnce());

    await act(async () => nativeCloseHandler?.());
    expect(apiMocks.closeWindow).not.toHaveBeenCalled();

    await act(async () => {
      resolveToggle("clicked");
      await Promise.resolve();
    });

    await waitFor(() => expect(apiMocks.closeWindow).toHaveBeenCalledWith("debug"));
    expect(apiMocks.closeWindow).toHaveBeenCalledTimes(1);
    expect(apiMocks.debugToggleViaUiOnly).toHaveBeenCalledTimes(1);
  });
});