import { describe, expect, it } from "vitest";
import { selectedProfileIdForStatus } from "@/lib/profile-selection";

const profiles = [
  { id: "first", name: "First" },
  { id: "second", name: "Second" }
];

describe("selectedProfileIdForStatus", () => {
  it("selects only an explicitly active profile", () => {
    expect(selectedProfileIdForStatus(profiles, "Second")).toBe("second");
  });

  it("does not guess the first profile when active state is unknown", () => {
    expect(selectedProfileIdForStatus(profiles, null)).toBe("");
    expect(selectedProfileIdForStatus(profiles, "Missing")).toBe("");
  });
});
