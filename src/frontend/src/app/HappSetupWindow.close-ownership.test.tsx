// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "@/lib/types";
import i18n from "@/lib/i18n";

const listenerMocks = vi.hoisted(() => ({ bindTauriListener: vi.fn() }));
const apiMocks = vi.hoisted(() => ({
  closeWindow: vi.fn(),
  detectHappPath: vi.fn(),
  getSettings: vi.fn(),
  probeHappCandidate: vi.fn(),
  updateHappSettings: vi.fn(),
  validateHappPath: vi.fn(),
}));

vi.mock("@/lib/api", () => apiMocks);
vi.mock("@/lib/tauri-listener", () => listenerMocks);

import { HappSetupWindow } from "@/app/HappSetupWindow";

const settings: AppSettings = {
  selected_client: "happ",
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

describe("HappSetupWindow close ownership", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("en");
    apiMocks.closeWindow.mockResolvedValue(true);
    apiMocks.getSettings.mockResolvedValue(settings);
    apiMocks.validateHappPath.mockResolvedValue({
      is_valid: true,
      message_key: "settings.happPathValid",
      normalized_path: "C:\\Happ\\Happ.exe",
    });
  });

  it("defers a native close until an in-flight save settles", async () => {
    let closeHandler: (() => void) | undefined;
    let resolveSave!: (value: AppSettings) => void;
    listenerMocks.bindTauriListener.mockImplementation((eventName: string, handler: () => void, _onError?: unknown, onReady?: () => void) => {
      if (eventName === "happ-setup-close-requested") closeHandler = handler;
      onReady?.();
      return () => undefined;
    });
    apiMocks.updateHappSettings.mockImplementationOnce(
      () => new Promise<AppSettings>((resolve) => { resolveSave = resolve; }),
    );

    await act(async () => {
      render(<HappSetupWindow />);
      await Promise.resolve();
    });
    await screen.findByRole("heading", { name: "Happ adapter setup" });

    fireEvent.change(screen.getByLabelText("Executable path"), {
      target: { value: "C:\\Happ\\Happ.exe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(apiMocks.updateHappSettings).toHaveBeenCalledOnce());

    await act(async () => closeHandler?.());
    expect(apiMocks.closeWindow).not.toHaveBeenCalled();
    expect(screen.queryByText("Unsaved settings")).toBeNull();

    await act(async () => {
      resolveSave({ ...settings, happ_path: "C:\\Happ\\Happ.exe" });
      await Promise.resolve();
    });

    await waitFor(() => expect(apiMocks.closeWindow).toHaveBeenCalledWith("happ-setup"));
    expect(screen.queryByText("Unsaved settings")).toBeNull();
  });
});
