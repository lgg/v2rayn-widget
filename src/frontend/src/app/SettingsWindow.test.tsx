import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "@/lib/types";
import "@/lib/i18n";

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

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => undefined)
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    hide: vi.fn()
  }))
}));

import { SettingsWindow } from "@/app/SettingsWindow";

const baseSettings: AppSettings = {
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
  latency_mode: "active",
  connectivity_endpoints: ["https://example.com/connect"],
  ip_endpoints: ["https://example.com/ip"],
  v2rayn_path_mode: "auto",
  v2rayn_path: null,
  window_position: null
};

describe("SettingsWindow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getSettings.mockResolvedValue(baseSettings);
    apiMocks.getAvailableLocales.mockResolvedValue([
      { code: "en", label: "English", native_label: "English" }
    ]);
    apiMocks.updateSettings.mockImplementation(async (settings: AppSettings) => settings);
    apiMocks.closeWindow.mockResolvedValue(undefined);
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
      v2rayn_path: null
    });
    expect(apiMocks.closeWindow).toHaveBeenCalledWith("settings");
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
});
