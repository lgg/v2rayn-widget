import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const localeLoaders = import.meta.glob("../locales/*.json", { eager: true }) as Record<string, { default: Record<string, string> }>;

const resources = Object.entries(localeLoaders).reduce<Record<string, { translation: Record<string, string> }>>(
  (acc, [path, module]) => {
    const code = path.split("/").pop()?.replace(".json", "") ?? "en";
    acc[code] = { translation: module.default };
    return acc;
  },
  {}
);

const supportedLanguages = new Set(["en", "ru"]);

export function detectInitialLanguage(): string {
  const language = navigator.language.toLowerCase();
  if (language.startsWith("ru") && supportedLanguages.has("ru")) {
    return "ru";
  }

  if (language.startsWith("en") && supportedLanguages.has("en")) {
    return "en";
  }

  return "en";
}

void i18n.use(initReactI18next).init({
  resources,
  lng: detectInitialLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false
  },
  keySeparator: false,
  nsSeparator: false
});

export default i18n;
