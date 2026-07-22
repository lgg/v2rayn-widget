// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@/lib/i18n";
import { ProfileSelector } from "@/components/profile-selector";

const profiles = [
  { id: "first", name: "First" },
  { id: "second", name: "Second" }
];

describe("ProfileSelector", () => {
  it("uses a native labelled combobox and emits only real profile ids", () => {
    const onSelect = vi.fn();
    render(
      <ProfileSelector
        profiles={profiles}
        selectedProfileId="first"
        activeProfileName="First"
        onSelect={onSelect}
      />
    );

    const combobox = screen.getByRole("combobox", { name: "Profile / server" });
    fireEvent.change(combobox, { target: { value: "second" } });
    expect(onSelect).toHaveBeenCalledWith("second");
  });

  it("shows the authoritative active name without guessing the first item", () => {
    render(
      <ProfileSelector
        profiles={profiles}
        selectedProfileId=""
        activeProfileName="External profile"
        onSelect={() => undefined}
      />
    );

    expect(screen.getByRole("option", { name: "External profile" })).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("");
  });
});
