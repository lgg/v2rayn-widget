// @vitest-environment jsdom

import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DebugRuntimeSnapshot, UiDebugReport } from "@/lib/types";
import "@/lib/i18n";

const listenerMocks = vi.hoisted(() => ({ bindTauriListener: vi.fn() }));
const apiMocks = vi.hoisted(() => ({
  closeWindow: vi.fn(),
  debugCaptureRuntimeSnapshot: vi.fn(),
  debugClickReloadViaUi: vi.fn(),
  debugSelectProfileViaUi: vi.fn(),
  debugToggleViaConfigOnly: vi.fn(),
  debugToggleViaUiOnly: vi.fn(),
  openV2RayN: vi.fn(),
  refreshStatus: vi.fn(),
  relaunchWidgetAsAdmin: vi.fn(),
  runUiDebugProbe: vi.fn(),
  toggleTunViaUi: vi.fn(),
}));

vi.mock("@/lib/api", () => apiMocks);
vi.mock("@/lib/tauri-listener", () => listenerMocks);

import { DebugWindow } from "@/app/DebugWindow";

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
  beforeEach(() => {
    vi.clearAllMocks();
    listenerMocks.bindTauriListener.mockReturnValue(() => undefined);
    apiMocks.closeWindow.mockResolvedValue(true);
    apiMocks.debugCaptureRuntimeSnapshot.mockResolvedValue(snapshot);
    apiMocks.runUiDebugProbe.mockResolvedValue(report);
  });

  it("routes a native close request through the shared safe close API", async () => {
    let nativeCloseHandler: (() => void) | undefined;
    listenerMocks.bindTauriListener.mockImplementation((eventName: string, handler: () => void) => {
      if (eventName === "debug-close-requested") {
        nativeCloseHandler = handler;
      }
      return () => undefined;
    });

    render(<DebugWindow />);
    await screen.findByRole("heading", { name: "Debug tools" });
    await waitFor(() => expect(apiMocks.runUiDebugProbe).toHaveBeenCalledTimes(1));

    await act(async () => {
      nativeCloseHandler?.();
    });

    expect(apiMocks.closeWindow).toHaveBeenCalledWith("debug");
  });
});
