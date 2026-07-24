import { describe, expect, it } from "vitest";
import en from "@/locales/en.json";
import ru from "@/locales/ru.json";

function sortedKeys(catalog: Record<string, string>): string[] {
  return Object.keys(catalog).sort((left, right) => left.localeCompare(right, "en"));
}

describe("locale catalogs", () => {
  it("keeps English and Russian keys exactly aligned", () => {
    expect(sortedKeys(ru)).toEqual(sortedKeys(en));
  });

  it.each([
    ["en", en],
    ["ru", ru],
  ] as const)("contains no blank %s translations", (_language, catalog) => {
    for (const [key, value] of Object.entries(catalog)) {
      expect(value.trim(), `${key} must not be blank`).not.toBe("");
    }
  });
});
