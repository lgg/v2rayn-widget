// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, ClientDiagnostics } from "@/lib/types";
import i18n from "@/lib/i18n";

const eventMocks = vi.hoisted(() => ({ listen: vi.fn() }));
const apiMocks = vi.hoisted(() => ({
  closeWindow: vi.fn(),
  detectHappPath: vi.fn(),
  getSettings: vi.fn(),
  probeHappCandidate: vi.fn(),
  updateHappSettings: vi.fn(),
  validateHappPath: vi.fn()
}));

vi.mock("@/lib/api", () => apiMocks);
vi.mock("@tauri-apps/api/event", () => eventMocks);

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
  window_position: null
};

const diagnostics: ClientDiagnostics = {
  client_id: "happ",
  application_running: true,
  process_id: 123,
  executable_path: "C:\\Happ\\Happ.exe",
  window_found: true,
  window_title: "Happ",
  connection_state: "Disconnected",
  transport_mode: "proxy",
  control_source: "windows_ui_automation",
  action_label: "Connect",
  action_score: 360,
  ui_nodes: ["action=Connect; automation_id=<redacted len=8>; class=<redacted len=6>; control_type=50000"],
  note: "Probe complete"
};

describe("HappSetupWindow", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("en");
    eventMocks.listen.mockResolvedValue(() => undefined);
    apiMocks.closeWindow.mockResolvedValue(true);
    apiMocks.getSettings.mockResolvedValue(settings);
    apiMocks.validateHappPath.mockResolvedValue({
      is_valid: true,
      message_key: "settings.happPathValid",
      normalized_path: "C:\\Happ\\Happ.exe"
    });
    apiMocks.updateHappSettings.mockImplementation(async (payload: { happ_path: string | null; happ_allow_ui_automation: boolean }) => ({
      ...settings,
      ...payload
    }));
    apiMocks.probeHappCandidate.mockResolvedValue(diagnostics);
  });

  afterEach(async () => {
    await i18n.changeLanguage("en");
    document.documentElement.classList.remove("dark");
    document.documentElement.style.removeProperty("--widget-opacity");
    document.body.classList.remove("widget-effect-disabled");
  });

  it("probes and persists explicit experimental control consent for the current candidate", async () => {
    render(<HappSetupWindow />);
    await screen.findByRole("heading", { name: "Happ adapter setup" });

    fireEvent.change(screen.getByLabelText("Executable path"), {
      target: { value: "C:\\Happ\\Happ.exe" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Happ probe" }));
    await screen.findByText("Probe complete");
    expect(apiMocks.probeHappCandidate).toHaveBeenCalledWith("C:\\Happ\\Happ.exe");

    fireEvent.click(screen.getByLabelText(/I understand and enable/));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(apiMocks.updateHappSettings).toHaveBeenCalledTimes(1));
    expect(apiMocks.updateHappSettings.mock.calls[0][0]).toMatchObject({
      happ_path: "C:\\Happ\\Happ.exe",
      happ_allow_ui_automation: true
    });
  });

  it("shows adapter probe details", async () => {
    render(<HappSetupWindow />);
    await screen.findByRole("heading", { name: "Happ adapter setup" });

    fireEvent.click(screen.getByRole("button", { name: "Run Happ probe" }));

    const actionRow = await screen.findByText((_, element) =>
      element?.tagName === "P"
      && element.textContent?.includes("Detected connection action") === true
      && element.textContent?.includes("Connect") === true
    );
    const scoreRow = screen.getByText((_, element) =>
      element?.tagName === "P"
      && element.textContent?.includes("Confidence score") === true
      && element.textContent?.includes("360") === true
    );

    expect(actionRow).toBeTruthy();
    expect(scoreRow).toBeTruthy();
    expect(screen.getByText("Probe complete")).toBeTruthy();
  });

  it("warns before native close when the setup draft changed", async () => {
    let closeHandler: (() => void) | undefined;
    eventMocks.listen.mockImplementation(async (eventName: string, handler: () => void) => {
      if (eventName === "happ-setup-close-requested") {
        closeHandler = handler;
      }
      return () => undefined;
    });

    render(<HappSetupWindow />);
    await screen.findByRole("heading", { name: "Happ adapter setup" });
    fireEvent.change(screen.getByLabelText("Executable path"), {
      target: { value: "C:\\Happ\\Happ.exe" }
    });

    await act(async () => {
      closeHandler?.();
    });
    expect(await screen.findByText("Unsaved settings")).toBeTruthy();
    expect(apiMocks.closeWindow).not.toHaveBeenCalled();
  });

  it("retains the setup draft and confirmation when safe discard close fails", async () => {
    apiMocks.closeWindow.mockResolvedValueOnce(false);
    render(<HappSetupWindow />);
    await screen.findByRole("heading", { name: "Happ adapter setup" });

    const pathInput = screen.getByLabelText("Executable path") as HTMLInputElement;
    fireEvent.change(pathInput, { target: { value: "C:\\Draft\\Happ.exe" } });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard changes" }));

    await waitFor(() => expect(apiMocks.closeWindow).toHaveBeenCalledWith("happ-setup"));
    expect(screen.getByText("Unsaved settings")).toBeTruthy();
    expect(pathInput.value).toBe("C:\\Draft\\Happ.exe");
  });

  it("preserves an unsaved setup draft when the application language changes", async () => {
    render(<HappSetupWindow />);
    await screen.findByRole("heading", { name: "Happ adapter setup" });

    const pathInput = screen.getByLabelText("Executable path") as HTMLInputElement;
    fireEvent.change(pathInput, { target: { value: "C:\\Draft\\Happ.exe" } });

    await act(async () => {
      await i18n.changeLanguage("ru");
    });

    await waitFor(() => expect(pathInput.value).toBe("C:\\Draft\\Happ.exe"));
    expect(apiMocks.getSettings).toHaveBeenCalledTimes(1);
  });

  it("applies saved surface settings and preserves a dirty draft across external updates", async () => {
    let settingsHandler: ((event: { payload: AppSettings }) => void) | undefined;
    eventMocks.listen.mockImplementation(async (eventName: string, handler: (event: { payload: AppSettings }) => void) => {
      if (eventName === "settings-updated") {
        settingsHandler = handler;
      }
      return () => undefined;
    });
    apiMocks.getSettings.mockResolvedValueOnce({
      ...settings,
      language: "ru",
      theme: "light",
      window_effect_enabled: false,
      window_opacity_percent: 73,
    });

    render(<HappSetupWindow />);
    await waitFor(() => expect(i18n.language).toBe("ru"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.getPropertyValue("--widget-opacity")).toBe("0.73");
    expect(document.body.classList.contains("widget-effect-disabled")).toBe(true);

    const pathInput = screen.getByLabelText("Путь к исполняемому файлу") as HTMLInputElement;
    fireEvent.change(pathInput, { target: { value: "C:\\Draft\\Happ.exe" } });

    await act(async () => {
      settingsHandler?.({
        payload: {
          ...settings,
          language: "en",
          theme: "dark",
          happ_path: "C:\\External\\Happ.exe",
        },
      });
    });

    await waitFor(() => expect(i18n.language).toBe("en"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(pathInput.value).toBe("C:\\Draft\\Happ.exe");
  });

  it("leaves loading and shows an error when settings cannot load", async () => {
    apiMocks.getSettings.mockRejectedValueOnce(new Error("disk failure"));
    render(<HappSetupWindow />);

    expect((await screen.findByRole("alert")).textContent).toContain("disk failure");
    expect(screen.queryByText("Loading...")).toBeNull();
  });

  it("retries the initial settings load after an error", async () => {
    apiMocks.getSettings.mockRejectedValueOnce(new Error("disk failure"));
    render(<HappSetupWindow />);

    expect((await screen.findByRole("alert")).textContent).toContain("disk failure");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { name: "Happ adapter setup" })).toBeTruthy();
    expect(apiMocks.getSettings).toHaveBeenCalledTimes(2);
  });
});
