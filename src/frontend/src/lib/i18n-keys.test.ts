import en from "@/locales/en.json";
import ru from "@/locales/ru.json";

const enLocale = en as Record<string, string>;
const ruLocale = ru as Record<string, string>;

function sortedKeys(source: Record<string, string>): string[] {
  return Object.keys(source).sort();
}

describe("i18n locale files", () => {
  it("must contain exactly same key set between en and ru", () => {
    expect(sortedKeys(ruLocale)).toEqual(sortedKeys(enLocale));
  });

  it("must not contain empty translations", () => {
    for (const [key, value] of Object.entries(enLocale)) {
      expect(key.length).toBeGreaterThan(0);
      expect(value.trim().length).toBeGreaterThan(0);
    }

    for (const [key, value] of Object.entries(ruLocale)) {
      expect(key.length).toBeGreaterThan(0);
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});
