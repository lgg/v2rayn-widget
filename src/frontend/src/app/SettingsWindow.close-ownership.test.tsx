// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "@/lib/types";
import i18n from "@/lib/i18n";

const appMocks = vi.hoisted(() => ({ getVersion: vi.fn() }));
const listenerMocks = vi.hoisted(() => ({ bindTauriListener: vi.fn() }));
const apiMocks = vi.hoisted(() => ({
  applyUiSettings: vi.fn(),
  closeWindow: vi.fn(),
  detectV2RayNPath: vi.fn(),
  getAvailableLocales: vi.fn(),
  getSettings: vi.fn(),
  openDebugWindow: vi.fn(),
  relaunchWidgetAsAdmin: vi.fn(),
  updateSettings: vi.fn(),
  validateV2RayNPath: vi.fn(),
}));

vi.mock("@tauri-apps/api/app", () => appMocks);
vi.mock("@/lib/tauri-listener", () => listenerMocks);
vi.mock("@/lib/api", () => apiMocks);

import { SettingsWindow } from "@/app/SettingsWindow";

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

async function renderSettings(): Promise<void> {
  await act(async () => {
    render(<SettingsWindow />);
    await Promise.resolve();
  });
  await screen.findByRole("heading", { name: "Settings" });
}

describe("SettingsWindow close ownership", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("en");
    appMocks.getVersion.mockResolvedValue("1.0.0");
    listenerMocks.bindTauriListener.mockImplementation((_eventName: string, _handler: unknown, _onError?: unknown, onReady?: () => void) => {
      onReady?.();
      return () => undefined;
    });
    apiMocks.getSettings.mockResolvedValue(settings);
    apiMocks.getAvailableLocales.mockResolvedValue([
      { code: "en", label: "English", native_label: "English" },
    ]);
    apiMocks.applyUiSettings.mockImplementation(async (patch: Partial<AppSettings>) => ({ ...settings, ...patch }));
    apiMocks.updateSettings.mockImplementation(async (payload: AppSettings) => payload);
    apiMocks.detectV2RayNPath.mockResolvedValue(null);
    apiMocks.validateV2RayNPath.mockResolvedValue({
      is_valid: true,
      message_key: "settings.pathValid",
      normalized_path: "C:\\Apps\\v2rayN",
    });
    apiMocks.closeWindow.mockResolvedValue(true);
  });

  it("keeps discard controls operable while disabling the editable form and Save", async () => {
    await renderSettings();

    fireEvent.click(screen.getByLabelText("Autostart with Windows"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    const keepEditing = await screen.findByRole("button", { name: "Keep editing" });
    const discard = screen.getByRole("button", { name: "Discard changes" });
    const save = screen.getByRole("button", { name: "Save" });

    expect(keepEditing.matches(":disabled")).toBe(false);
    expect(discard.matches(":disabled")).toBe(false);
    expect(save.matches(":disabled")).toBe(true);
    expect(screen.getByLabelText("Autostart with Windows").matches(":disabled")).toBe(true);

    fireEvent.click(keepEditing);
    expect(screen.queryByText("Unsaved settings")).toBeNull();
  });

  it("allows only one discard close while the safe close is pending", async () => {
    let resolveClose!: (value: boolean) => void;
    apiMocks.closeWindow.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => { resolveClose = resolve; }),
    );
    await renderSettings();

    fireEvent.click(screen.getByLabelText("Autostart with Windows"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    const discard = await screen.findByRole("button", { name: "Discard changes" });

    fireEvent.click(discard);
    fireEvent.click(discard);
    expect(apiMocks.closeWindow).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveClose(true);
      await Promise.resolve();
    });
  });

  it("defers native close during a full save and closes exactly once", async () => {
    let nativeCloseHandler: (() => void) | undefined;
    let resolveSave!: (value: AppSettings) => void;
    listenerMocks.bindTauriListener.mockImplementation((eventName: string, handler: () => void, _onError?: unknown, onReady?: () => void) => {
      if (eventName === "settings-close-requested") nativeCloseHandler = handler;
      onReady?.();
      return () => undefined;
    });
    apiMocks.updateSettings.mockImplementationOnce(
      () => new Promise<AppSettings>((resolve) => { resolveSave = resolve; }),
    );
    await renderSettings();

    fireEvent.click(screen.getByLabelText("Autostart with Windows"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(apiMocks.updateSettings).toHaveBeenCalledOnce());

    await act(async () => {
      nativeCloseHandler?.();
      nativeCloseHandler?.();
    });
    expect(apiMocks.closeWindow).not.toHaveBeenCalled();

    await act(async () => {
      resolveSave({ ...settings, autostart_with_windows: true });
      await Promise.resolve();
    });

    await waitFor(() => expect(apiMocks.closeWindow).toHaveBeenCalledWith("settings"));
    expect(apiMocks.closeWindow).toHaveBeenCalledTimes(1);
  });

  it("serializes path detection and defers close into unsaved confirmation", async () => {
    let nativeCloseHandler: (() => void) | undefined;
    let resolveDetect!: (value: string | null) => void;
    listenerMocks.bindTauriListener.mockImplementation((eventName: string, handler: () => void, _onError?: unknown, onReady?: () => void) => {
      if (eventName === "settings-close-requested") nativeCloseHandler = handler;
      onReady?.();
      return () => undefined;
    });
    apiMocks.detectV2RayNPath.mockImplementationOnce(
      () => new Promise<string | null>((resolve) => { resolveDetect = resolve; }),
    );
    await renderSettings();

    const detect = screen.getByRole("button", { name: "Detect path" });
    fireEvent.click(detect);
    fireEvent.click(detect);
    await waitFor(() => expect(apiMocks.detectV2RayNPath).toHaveBeenCalledOnce());
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => nativeCloseHandler?.());
    expect(apiMocks.closeWindow).not.toHaveBeenCalled();
    expect(screen.queryByText("Unsaved settings")).toBeNull();

    await act(async () => {
      resolveDetect("C:\\Apps\\v2rayN");
      await Promise.resolve();
    });

    await screen.findByText("Unsaved settings");
    expect(apiMocks.closeWindow).not.toHaveBeenCalled();
    expect(apiMocks.detectV2RayNPath).toHaveBeenCalledTimes(1);
  });
});
