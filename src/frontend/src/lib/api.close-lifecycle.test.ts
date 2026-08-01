import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));

import { shouldReloadClosedDraftSurface } from "@/lib/api";

describe("closed draft surface lifecycle", () => {
  it("reloads only the current Settings or Happ Setup surface", () => {
    expect(shouldReloadClosedDraftSurface("settings", "settings")).toBe(true);
    expect(shouldReloadClosedDraftSurface("happ-setup", "happ-setup")).toBe(true);
    expect(shouldReloadClosedDraftSurface("settings", "main")).toBe(false);
    expect(shouldReloadClosedDraftSurface("debug", "debug")).toBe(false);
    expect(shouldReloadClosedDraftSurface("main", "main")).toBe(false);
  });
});
