import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "@/lib/types";
import "@/lib/i18n";

const eventMocks = vi.hoisted(() => ({ listen: vi.fn() }));
const appMocks = vi.hoisted(() => ({ getVersion: vi.fn() }));
const apiMocks = vi.hoisted(() => ({
  applyUiSettings: vi.fn(),
  closeWindow: vi.fn(),
  detectV2RayNPath: vi.fn(),
  getAvailableLocales: vi.fn(),
  getSettings: vi.fn(),
  openDebugWindow: vi.fn(),
  relaunchWidgetAsAdmin: vi.fn(),
  updateSettings: vi.fn(),
  validateV2RayNPath: vi.fn()
}));

vi.mock("@/lib/api", () => apiMocks);
vi.mock("@tauri-apps/api/app", () => appMocks);
vi.mock("@tauri-apps/api/event", () => eventMocks);

import { mergeUiFields, SettingsWindow } from "@/app/SettingsWindow";

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
  connectivity_endpoints: ["https://example.com/connect"],
  ip_endpoints: ["https://example.com/ip"],
  v2rayn_path_mode: "auto",
  v2rayn_path: null,
  happ_path: null,
  happ_allow_ui_automation: false,
  window_position: null
};

describe("SettingsWindow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventMocks.listen.mockResolvedValue(() => undefined);
    appMocks.getVersion.mockResolvedValue("1.2.3");
    apiMocks.getSettings.mockResolvedValue(baseSettings);
    apiMocks.getAvailableLocales.mockResolvedValue([
      { code: "en", label: "English", native_label: "English" }
    ]);
    apiMocks.updateSettings.mockImplementation(async (settings: AppSettings) => settings);
    apiMocks.applyUiSettings.mockImplementation(async (patch: Partial<AppSettings>) => ({ ...baseSettings, ...patch }));
    apiMocks.closeWindow.mockResolvedValue(true);
  });

  it("shows the runtime application version instead of a hardcoded release", async () => {
    render(<SettingsWindow />);

    await screen.findByRole("heading", { name: "Settings" });

    expect(await screen.findByText(/Version:\s*1\.2\.3/)).not.toBeNull();
    expect(appMocks.getVersion).toHaveBeenCalledTimes(1);
  });

  it("saves draft-only application settings", async () => {
    render(<SettingsWindow />);

    await screen.findByRole("heading", { name: "Settings" });

    fireEvent.click(screen.getByLabelText("Autostart with Windows"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(apiMocks.updateSettings).toHaveBeenCalledTimes(1);
    });

    expect(apiMocks.updateSettings.mock.calls[0][0]).toMatchObject({
      autostart_with_windows: true,
      v2rayn_path_mode: "auto",
      v2rayn_path: null,
      happ_allow_ui_automation: false
    });
    expect(apiMocks.closeWindow).toHaveBeenCalledWith("settings");
  });

  it("saves diagnostics page settings with normalized site URL", async () => {
    render(<SettingsWindow />);

    await screen.findByRole("heading", { name: "Settings" });

    fireEvent.click(screen.getByLabelText("Enable diagnostics page"));
    fireEvent.change(screen.getByLabelText("Diagnostics site"), { target: { value: "browserleaks.com/ip" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(apiMocks.updateSettings).toHaveBeenCalledTimes(1);
    });

    expect(apiMocks.updateSettings.mock.calls[0][0]).toMatchObject({
      diagnostics_enabled: true,
      diagnostics_url: "https://browserleaks.com/ip"
    });
  });

  it("warns before native close with unsaved draft settings", async () => {
    let closeHandler: (() => void) | undefined;
    eventMocks.listen.mockImplementation(async (eventName: string, handler: () => void) => {
      if (eventName === "settings-close-requested") {
        closeHandler = handler;
      }
      return () => undefined;
    });

    render(<SettingsWindow />);
    await screen.findByRole("heading", { name: "Settings" });

    fireEvent.click(screen.getByLabelText("Autostart with Windows"));
    await act(async () => {
      closeHandler?.();
    });

    expect(await screen.findByText("Unsaved settings")).not.toBeNull();
    expect(apiMocks.closeWindow).not.toHaveBeenCalled();
  });

  it("warns before closing with unsaved draft settings", async () => {
    render(<SettingsWindow />);

    await screen.findByRole("heading", { name: "Settings" });

    fireEvent.click(screen.getByLabelText("Autostart with Windows"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(await screen.findByText("Unsaved settings")).not.toBeNull();
    expect(apiMocks.closeWindow).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByText("Unsaved settings")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard changes" }));

    await waitFor(() => {
      expect(apiMocks.closeWindow).toHaveBeenCalledWith("settings");
    });
  });

  it("retains the dirty draft and confirmation when safe discard close fails", async () => {
    apiMocks.closeWindow.mockResolvedValueOnce(false);
    render(<SettingsWindow />);
    await screen.findByRole("heading", { name: "Settings" });

    fireEvent.click(screen.getByLabelText("Autostart with Windows"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard changes" }));

    await waitFor(() => expect(apiMocks.closeWindow).toHaveBeenCalledWith("settings"));
    expect(screen.getByText("Unsaved settings")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(await screen.findByText("Unsaved settings")).not.toBeNull();
  });

  it("keeps current adapter-owned fields while preserving an unrelated dirty draft", () => {
    const dirtyDraft: AppSettings = {
      ...baseSettings,
      autostart_with_windows: true,
      allow_restart_fallback: true
    };
    const external: AppSettings = {
      ...baseSettings,
      selected_client: "happ",
      happ_path: "C:\\Happ\\Happ.exe",
      happ_allow_ui_automation: true,
      window_position: { x: 10, y: 20, width: 360, height: 500 }
    };

    const merged = mergeUiFields(dirtyDraft, external);

    expect(merged.autostart_with_windows).toBe(true);
    expect(merged.allow_restart_fallback).toBe(true);
    expect(merged.selected_client).toBe("happ");
    expect(merged.happ_path).toBe("C:\\Happ\\Happ.exe");
    expect(merged.happ_allow_ui_automation).toBe(true);
    expect(merged.window_position).toEqual(external.window_position);
  });

  it("sends only the changed live UI field to avoid stale overwrite", async () => {
    render(<SettingsWindow />);
    await screen.findByRole("heading", { name: "Settings" });

    fireEvent.click(screen.getByLabelText("Always on top"));

    await waitFor(() => {
      expect(apiMocks.applyUiSettings).toHaveBeenCalledWith({ always_on_top: true });
    });
  });

  it("ignores a stale live-save failure after authoritative settings arrive", async () => {
    let settingsHandler: ((event: { payload: AppSettings }) => void) | undefined;
    let rejectLiveWrite!: (error: Error) => void;
    eventMocks.listen.mockImplementation(async (eventName: string, handler: (event: { payload: AppSettings }) => void) => {
      if (eventName === "settings-updated") settingsHandler = handler;
      return () => undefined;
    });
    apiMocks.applyUiSettings.mockImplementationOnce(
      () => new Promise<AppSettings>((_resolve, reject) => {
        rejectLiveWrite = reject;
      }),
    );

    render(<SettingsWindow />);
    await screen.findByRole("heading", { name: "Settings" });
    await waitFor(() => expect(settingsHandler).toBeDefined());

    fireEvent.click(screen.getByLabelText("Always on top"));
    await waitFor(() => expect(apiMocks.applyUiSettings).toHaveBeenCalledTimes(1));

    await act(async () => {
      settingsHandler?.({ payload: { ...baseSettings, theme: "light" } });
      rejectLiveWrite(new Error("stale live failure"));
      await Promise.resolve();
    });

    expect(apiMocks.getSettings).toHaveBeenCalledTimes(1);
  });

  it("serializes the full save after pending live UI writes", async () => {
    let resolveLiveWrite!: (value: AppSettings) => void;
    apiMocks.applyUiSettings.mockImplementationOnce(
      () => new Promise<AppSettings>((resolve) => {
        resolveLiveWrite = resolve;
      }),
    );

    render(<SettingsWindow />);
    await screen.findByRole("heading", { name: "Settings" });

    fireEvent.click(screen.getByLabelText("Always on top"));
    fireEvent.click(screen.getByLabelText("Autostart with Windows"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(apiMocks.applyUiSettings).toHaveBeenCalledTimes(1));
    expect(apiMocks.updateSettings).not.toHaveBeenCalled();

    await act(async () => {
      resolveLiveWrite({ ...baseSettings, always_on_top: true });
    });

    await waitFor(() => expect(apiMocks.updateSettings).toHaveBeenCalledTimes(1));
    expect(apiMocks.updateSettings.mock.calls[0][0]).toMatchObject({
      always_on_top: true,
      autostart_with_windows: true,
    });
    expect(apiMocks.applyUiSettings.mock.invocationCallOrder[0]).toBeLessThan(
      apiMocks.updateSettings.mock.invocationCallOrder[0],
    );
  });

  it("waits for failed live-patch recovery before starting the full save", async () => {
    let resolveRecovery!: (value: AppSettings) => void;
    apiMocks.applyUiSettings.mockRejectedValueOnce(new Error("write failed"));
    apiMocks.getSettings
      .mockResolvedValueOnce(baseSettings)
      .mockImplementationOnce(
        () => new Promise<AppSettings>((resolve) => {
          resolveRecovery = resolve;
        }),
      );

    render(<SettingsWindow />);
    await screen.findByRole("heading", { name: "Settings" });

    fireEvent.click(screen.getByLabelText("Always on top"));
    fireEvent.click(screen.getByLabelText("Autostart with Windows"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(apiMocks.getSettings).toHaveBeenCalledTimes(2));
    expect(apiMocks.updateSettings).not.toHaveBeenCalled();

    await act(async () => {
      resolveRecovery(baseSettings);
    });

    await waitFor(() => expect(apiMocks.updateSettings).toHaveBeenCalledTimes(1));
  });

  it("does not let a stale initial load overwrite a newer settings event", async () => {
    let resolveSettings!: (value: AppSettings) => void;
    let settingsHandler: ((event: { payload: AppSettings }) => void) | undefined;
    apiMocks.getSettings.mockImplementationOnce(
      () => new Promise<AppSettings>((resolve) => {
        resolveSettings = resolve;
      }),
    );
    eventMocks.listen.mockImplementation(async (eventName: string, handler: (event: { payload: AppSettings }) => void) => {
      if (eventName === "settings-updated") {
        settingsHandler = handler;
      }
      return () => undefined;
    });

    render(<SettingsWindow />);
    await waitFor(() => expect(settingsHandler).toBeDefined());

    await act(async () => {
      settingsHandler?.({ payload: { ...baseSettings, theme: "light" } });
      resolveSettings(baseSettings);
    });

    await screen.findByRole("heading", { name: "Settings" });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("leaves the loading state and shows an error when settings cannot load", async () => {
    apiMocks.getSettings.mockRejectedValueOnce(new Error("disk failure"));
    render(<SettingsWindow />);

    expect((await screen.findByRole("alert")).textContent).toContain("Could not load settings");
    expect(screen.queryByText("Loading...")).toBeNull();
  });

  it("retries the complete initial settings load after an error", async () => {
    apiMocks.getSettings.mockRejectedValueOnce(new Error("disk failure"));
    render(<SettingsWindow />);

    expect((await screen.findByRole("alert")).textContent).toContain("Could not load settings");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { name: "Settings" })).not.toBeNull();
    expect(apiMocks.getSettings).toHaveBeenCalledTimes(2);
    expect(apiMocks.getAvailableLocales).toHaveBeenCalledTimes(2);
  });

  it("shows a save error and keeps the window open when persistence fails", async () => {
    apiMocks.updateSettings.mockRejectedValueOnce(new Error("disk full"));
    render(<SettingsWindow />);
    await screen.findByRole("heading", { name: "Settings" });

    fireEvent.click(screen.getByLabelText("Autostart with Windows"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Could not save settings");
    expect(apiMocks.closeWindow).not.toHaveBeenCalled();
  });

  it("registers settings events before loading and leaves loading on an authoritative event", async () => {
    let settingsHandler: ((event: { payload: AppSettings }) => void) | undefined;
    apiMocks.getSettings.mockReturnValueOnce(new Promise<AppSettings>(() => undefined));
    eventMocks.listen.mockImplementation(async (eventName: string, handler: (event: { payload: AppSettings }) => void) => {
      if (eventName === "settings-updated") settingsHandler = handler;
      return () => undefined;
    });

    render(<SettingsWindow />);
    await waitFor(() => expect(settingsHandler).toBeDefined());
    await act(async () => settingsHandler?.({ payload: { ...baseSettings, theme: "light" } }));

    expect(await screen.findByRole("heading", { name: "Settings" })).not.toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("waits for a pending live write before closing", async () => {
    let resolveLiveWrite!: (value: AppSettings) => void;
    apiMocks.applyUiSettings.mockImplementationOnce(
      () => new Promise<AppSettings>((resolve) => { resolveLiveWrite = resolve; }),
    );

    render(<SettingsWindow />);
    await screen.findByRole("heading", { name: "Settings" });
    fireEvent.click(screen.getByLabelText("Always on top"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(apiMocks.applyUiSettings).toHaveBeenCalledOnce());
    expect(apiMocks.closeWindow).not.toHaveBeenCalled();

    await act(async () => resolveLiveWrite({ ...baseSettings, always_on_top: true }));
    await waitFor(() => expect(apiMocks.closeWindow).toHaveBeenCalledWith("settings"));
  });

  it("keeps the window open and rolls back an unrecoverable live write", async () => {
    let rejectLiveWrite!: (error: Error) => void;
    apiMocks.applyUiSettings.mockImplementationOnce(
      () => new Promise<AppSettings>((_resolve, reject) => { rejectLiveWrite = reject; }),
    );
    apiMocks.getSettings
      .mockResolvedValueOnce(baseSettings)
      .mockRejectedValueOnce(new Error("recovery failed"));

    render(<SettingsWindow />);
    await screen.findByRole("heading", { name: "Settings" });
    const alwaysOnTop = screen.getByLabelText("Always on top") as HTMLInputElement;
    fireEvent.click(alwaysOnTop);
    expect(alwaysOnTop.checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(apiMocks.applyUiSettings).toHaveBeenCalledOnce());

    await act(async () => rejectLiveWrite(new Error("write failed")));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not save settings");
    expect(alwaysOnTop.checked).toBe(false);
    expect(apiMocks.closeWindow).not.toHaveBeenCalled();
  });

});
