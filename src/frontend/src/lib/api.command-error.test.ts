import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => apiMocks);
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));

import { openSelectedClient, toggleSelectedClient } from "@/lib/api";

describe("Tauri command error boundary", () => {
  beforeEach(() => {
    apiMocks.invoke.mockReset();
  });

  it("preserves a Rust string error as an Error message", async () => {
    apiMocks.invoke.mockRejectedValueOnce(
      "UIPI_MISMATCH: widget and proxy client privileges differ",
    );

    await expect(toggleSelectedClient()).rejects.toMatchObject({
      message: "UIPI_MISMATCH: widget and proxy client privileges differ",
    });
  });

  it("preserves an object message and provides a stable fallback", async () => {
    apiMocks.invoke
      .mockRejectedValueOnce({ message: "HAPP_START_TIMEOUT: process not observed" })
      .mockRejectedValueOnce(undefined);

    await expect(openSelectedClient()).rejects.toMatchObject({
      message: "HAPP_START_TIMEOUT: process not observed",
    });
    await expect(openSelectedClient()).rejects.toMatchObject({
      message: "Tauri command failed",
    });
  });

  it("treats a stale client-open context as an expected cancellation", async () => {
    apiMocks.invoke.mockRejectedValueOnce(
      "CLIENT_CONTEXT_CHANGED: selected proxy client changed while the operation was running",
    );

    await expect(openSelectedClient()).resolves.toBeUndefined();
  });
});
