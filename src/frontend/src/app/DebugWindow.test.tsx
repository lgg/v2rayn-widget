// @vitest-environment jsdom

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

async function renderDebugWindow(): Promise<void> {
  await act(async () => {
    render(<DebugWindow />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

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

describe("DebugWindow", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("en");
    document.documentElement.classList.remove("dark");
    document.documentElement.style.removeProperty("--widget-opacity");
    document.body.classList.remove("widget-effect-disabled");
    listenerMocks.bindTauriListener.mockImplementation((_eventName: string, _handler: unknown, _onError?: unknown, onReady?: () => void) => {
      onReady?.();
      return () => undefined;
    });
    apiMocks.closeWindow.mockResolvedValue(true);
    apiMocks.getSettings.mockResolvedValue(settings);
    apiMocks.debugCaptureRuntimeSnapshot.mockResolvedValue(snapshot);
    apiMocks.runUiDebugProbe.mockResolvedValue(report);
  });

  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    document.documentElement.classList.remove("dark");
    document.documentElement.style.removeProperty("--widget-opacity");
    document.body.classList.remove("widget-effect-disabled");
  });

  it("applies persisted settings and reacts to settings-updated events", async () => {
    let settingsHandler: ((event: { payload: AppSettings }) => void) | undefined;
    listenerMocks.bindTauriListener.mockImplementation((eventName: string, handler: (event: { payload: AppSettings }) => void, _onError?: unknown, onReady?: () => void) => {
      if (eventName === "settings-updated") settingsHandler = handler;
      onReady?.();
      return () => undefined;
    });
    apiMocks.getSettings.mockResolvedValueOnce({
      ...settings,
      language: "ru",
      theme: "light",
      window_effect_enabled: false,
      window_opacity_percent: 64,
    });

    await renderDebugWindow();
    await waitFor(() => expect(i18n.language).toBe("ru"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.getPropertyValue("--widget-opacity")).toBe("0.64");
    expect(document.body.classList.contains("widget-effect-disabled")).toBe(true);

    await act(async () => {
      settingsHandler?.({ payload: { ...settings, language: "en", theme: "dark" } });
    });

    await waitFor(() => expect(i18n.language).toBe("en"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("does not let a stale initial load overwrite a newer settings event", async () => {
    let resolveSettings!: (value: AppSettings) => void;
    let settingsHandler: ((event: { payload: AppSettings }) => void) | undefined;
    apiMocks.getSettings.mockImplementationOnce(
      () => new Promise<AppSettings>((resolve) => {
        resolveSettings = resolve;
      }),
    );
    listenerMocks.bindTauriListener.mockImplementation((eventName: string, handler: (event: { payload: AppSettings }) => void, _onError?: unknown, onReady?: () => void) => {
      if (eventName === "settings-updated") settingsHandler = handler;
      onReady?.();
      return () => undefined;
    });

    await renderDebugWindow();
    await waitFor(() => expect(settingsHandler).toBeDefined());

    await act(async () => {
      settingsHandler?.({ payload: { ...settings, theme: "dark" } });
      resolveSettings({ ...settings, theme: "light" });
    });

    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true));
  });

  it("routes a native close request through the shared safe close API", async () => {
    let nativeCloseHandler: (() => void) | undefined;
    listenerMocks.bindTauriListener.mockImplementation((eventName: string, handler: () => void, _onError?: unknown, onReady?: () => void) => {
      if (eventName === "debug-close-requested") nativeCloseHandler = handler;
      onReady?.();
      return () => undefined;
    });

    await renderDebugWindow();
    await screen.findByRole("heading", { name: "v2rayN Debug Tools" });
    await waitFor(() => expect(apiMocks.runUiDebugProbe).toHaveBeenCalledTimes(1));

    await act(async () => {
      nativeCloseHandler?.();
    });

    expect(apiMocks.closeWindow).toHaveBeenCalledWith("debug");
  });

  it("does not request settings before the settings listener is registered", async () => {
    let ready: (() => void) | undefined;
    listenerMocks.bindTauriListener.mockImplementation((eventName: string, _handler: unknown, _onError?: unknown, onReady?: () => void) => {
      if (eventName === "settings-updated") ready = onReady;
      else onReady?.();
      return () => undefined;
    });

    await renderDebugWindow();
    expect(apiMocks.getSettings).not.toHaveBeenCalled();
    await act(async () => ready?.());
    await waitFor(() => expect(apiMocks.getSettings).toHaveBeenCalledOnce());
  });

  it("blocks v2rayN commands while Happ is selected and enables them after a switch", async () => {
    let settingsHandler: ((event: { payload: AppSettings }) => void) | undefined;
    listenerMocks.bindTauriListener.mockImplementation((eventName: string, handler: (event: { payload: AppSettings }) => void, _onError?: unknown, onReady?: () => void) => {
      if (eventName === "settings-updated") settingsHandler = handler;
      onReady?.();
      return () => undefined;
    });
    apiMocks.getSettings.mockResolvedValueOnce({ ...settings, selected_client: "happ" });

    render(<DebugWindow />);
    const adapterNotice = await screen.findByText(/These tools control v2rayN only/);
    expect(adapterNotice.textContent).toContain("v2rayN");
    expect((screen.getByRole("button", { name: "Open v2rayN" }) as HTMLButtonElement).disabled).toBe(true);
    expect(apiMocks.runUiDebugProbe).not.toHaveBeenCalled();

    await act(async () => settingsHandler?.({ payload: settings }));
    await waitFor(() => expect(apiMocks.runUiDebugProbe).toHaveBeenCalledOnce());
    expect((screen.getByRole("button", { name: "Open v2rayN" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("drops an in-flight probe result after the adapter changes", async () => {
    let settingsHandler: ((event: { payload: AppSettings }) => void) | undefined;
    let resolveProbe!: (value: UiDebugReport) => void;
    listenerMocks.bindTauriListener.mockImplementation((eventName: string, handler: (event: { payload: AppSettings }) => void, _onError?: unknown, onReady?: () => void) => {
      if (eventName === "settings-updated") settingsHandler = handler;
      onReady?.();
      return () => undefined;
    });
    apiMocks.runUiDebugProbe.mockImplementationOnce(
      () => new Promise<UiDebugReport>((resolve) => { resolveProbe = resolve; }),
    );

    await renderDebugWindow();
    await waitFor(() => expect(apiMocks.runUiDebugProbe).toHaveBeenCalledOnce());
    await act(async () => settingsHandler?.({ payload: { ...settings, selected_client: "happ" } }));
    expect(await screen.findByText(/These tools control v2rayN only/)).toBeTruthy();

    await act(async () => {
      resolveProbe(report);
      await Promise.resolve();
    });
    expect(screen.queryByText("Probe complete")).toBeNull();
    expect((screen.getByRole("button", { name: "Open v2rayN" }) as HTMLButtonElement).disabled).toBe(true);
  });

});
