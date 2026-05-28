import { beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import type { DashboardStatus } from "@/lib/types";

const apiMocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getStatus: vi.fn(),
  listProfiles: vi.fn(),
  openDebugWindow: vi.fn(),
  openDiagnosticsWindow: vi.fn(),
  openSettingsWindow: vi.fn(),
  openV2RayN: vi.fn(),
  refreshStatus: vi.fn(),
  refreshStatusBackground: vi.fn(),
  refreshStatusPostRoute: vi.fn(),
  refreshStatusStartup: vi.fn(),
  relaunchWidgetAsAdmin: vi.fn(),
  setActiveProfile: vi.fn(),
  toggleTunViaUi: vi.fn()
}));

vi.mock("@/lib/api", () => apiMocks);

import { useDashboardStore } from "@/features/dashboard-store";

function status(updatedAt: string): DashboardStatus {
  return {
    status: "Connected",
    tun_enabled: true,
    connection_state: "Connected",
    active_profile_name: "demo",
    external_ip: null,
    latency_ms: null,
    last_error: null,
    last_event: null,
    updated_at: updatedAt
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

describe("dashboard store refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.listProfiles.mockResolvedValue([]);
    useDashboardStore.setState({
      status: null,
      profiles: [],
      loading: false,
      actionLoading: false,
      error: null,
      notice: null
    });
  });

  it("queues a manual refresh when background refresh is already running", async () => {
    const background = deferred<DashboardStatus>();
    apiMocks.refreshStatusBackground.mockReturnValueOnce(background.promise);
    apiMocks.refreshStatus.mockResolvedValueOnce(status("manual"));

    const backgroundRun = useDashboardStore.getState().refresh({ background: true });
    const manualRun = useDashboardStore.getState().refresh();

    expect(useDashboardStore.getState().actionLoading).toBe(true);
    expect(apiMocks.refreshStatus).not.toHaveBeenCalled();

    background.resolve(status("background"));
    await backgroundRun;
    await manualRun;

    await waitFor(() => {
      expect(apiMocks.refreshStatus).toHaveBeenCalledTimes(1);
    });

    expect(useDashboardStore.getState().status?.updated_at).toBe("manual");
    expect(useDashboardStore.getState().actionLoading).toBe(false);
  });

  it("opens the diagnostics window through the backend command", async () => {
    apiMocks.openDiagnosticsWindow.mockResolvedValue(undefined);

    await useDashboardStore.getState().openDiagnostics();

    expect(apiMocks.openDiagnosticsWindow).toHaveBeenCalledTimes(1);
  });
});
