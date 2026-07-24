// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("keeps the close API resolved and reports a visible failure when IPC rejects", async () => {
    coreMocks.invoke.mockRejectedValueOnce(new Error("main window restore failed"));
    render(<WindowCloseFailureBanner />);

    await expect(closeWindow("settings")).resolves.toBeUndefined();

    expect(coreMocks.invoke).toHaveBeenCalledWith("close_window", { label: "settings" });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The window could not be closed safely");
    expect(alert.getAttribute("data-window-label")).toBe("settings");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not show feedback after a successful safe close command", async () => {
    coreMocks.invoke.mockResolvedValueOnce(undefined);
    render(<WindowCloseFailureBanner />);

    await closeWindow("debug");

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
