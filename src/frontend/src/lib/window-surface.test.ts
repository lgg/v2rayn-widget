import { describe, expect, it } from "vitest";
import { resolveWindowSurface } from "@/lib/window-surface";

describe("resolveWindowSurface", () => {
  it("routes auxiliary webviews synchronously", () => {
    expect(resolveWindowSurface("settings")).toBe("settings");
    expect(resolveWindowSurface("debug")).toBe("debug");
    expect(resolveWindowSurface("happ-setup")).toBe("happ-setup");
  });

  it("falls back to the main surface for unknown labels", () => {
    expect(resolveWindowSurface("main")).toBe("main");
    expect(resolveWindowSurface("unexpected")).toBe("main");
  });
});
