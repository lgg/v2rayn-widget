import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { shouldReloadClosedDraftSurface } from "@/lib/api";

describe("closed draft surface lifecycle", () => {
  it("reloads only Settings or Happ Setup inside the Tauri runtime", () => {
    expect(shouldReloadClosedDraftSurface("settings", true)).toBe(true);
    expect(shouldReloadClosedDraftSurface("happ-setup", true)).toBe(true);
    expect(shouldReloadClosedDraftSurface("debug", true)).toBe(false);
    expect(shouldReloadClosedDraftSurface("main", true)).toBe(false);
    expect(shouldReloadClosedDraftSurface("settings", false)).toBe(false);
    expect(shouldReloadClosedDraftSurface("happ-setup", false)).toBe(false);
  });
});
