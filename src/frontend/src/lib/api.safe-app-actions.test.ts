import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => apiMocks);
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));

import { exitApp, relaunchWidgetAsAdmin } from "@/lib/api";

describe("guarded application actions", () => {
  beforeEach(() => {
    apiMocks.invoke.mockReset();
    apiMocks.invoke.mockResolvedValue(undefined);
  });

  it("routes administrator relaunch through the draft-safe backend command", async () => {
    await relaunchWidgetAsAdmin();

    expect(apiMocks.invoke).toHaveBeenCalledWith(
      "request_relaunch_widget_as_admin",
    );
    expect(apiMocks.invoke).not.toHaveBeenCalledWith(
      "relaunch_widget_as_admin",
    );
  });

  it("routes application exit through the draft-safe backend command", async () => {
    await exitApp();

    expect(apiMocks.invoke).toHaveBeenCalledWith("request_exit_app");
    expect(apiMocks.invoke).not.toHaveBeenCalledWith("exit_app");
  });
});
