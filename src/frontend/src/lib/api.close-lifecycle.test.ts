import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));

import { shouldReloadClosedDraftSurface } from "@/lib/api";

describe("closed draft surface lifecycle", () => {
  it("reloads only the matching Settings or Happ Setup Tauri surface", () => {
    expect(shouldReloadClosedDraftSurface("settings", "settings", true)).toBe(true);
    expect(shouldReloadClosedDraftSurface("happ-setup", "happ-setup", true)).toBe(true);
    expect(shouldReloadClosedDraftSurface("settings", "main", true)).toBe(false);
    expect(shouldReloadClosedDraftSurface("happ-setup", "settings", true)).toBe(false);
    expect(shouldReloadClosedDraftSurface("debug", "debug", true)).toBe(false);
    expect(shouldReloadClosedDraftSurface("main", "main", true)).toBe(false);
    expect(shouldReloadClosedDraftSurface("settings", "settings", false)).toBe(false);
    expect(shouldReloadClosedDraftSurface("happ-setup", "happ-setup", false)).toBe(false);
    expect(shouldReloadClosedDraftSurface("settings", null, true)).toBe(false);
  });
});
