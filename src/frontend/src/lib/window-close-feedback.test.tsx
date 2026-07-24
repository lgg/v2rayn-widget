// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/lib/i18n";

const coreMocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => coreMocks);

import { WindowCloseFailureBanner } from "@/components/window-close-failure-banner";
import { closeWindow } from "@/lib/api";

describe("safe auxiliary close feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false and reports a visible failure when close IPC rejects", async () => {
    coreMocks.invoke.mockRejectedValueOnce(new Error("main window restore failed"));
    render(<WindowCloseFailureBanner />);

    await expect(closeWindow("settings")).resolves.toBe(false);

    expect(coreMocks.invoke).toHaveBeenCalledWith("close_window", { label: "settings" });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The window could not be closed safely");
    expect(alert.getAttribute("data-window-label")).toBe("settings");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("returns true without feedback after a successful safe close command", async () => {
    coreMocks.invoke.mockResolvedValueOnce(undefined);
    render(<WindowCloseFailureBanner />);

    await expect(closeWindow("debug")).resolves.toBe(true);

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
