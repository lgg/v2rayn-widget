import i18n from "@/lib/i18n";
import type { AppSettings } from "@/lib/types";

export async function applySurfaceSettings(settings: AppSettings): Promise<void> {
  const root = document.documentElement;
  const body = document.body;
  const opacity = Math.max(10, Math.min(100, Math.round(settings.window_opacity_percent)));

  root.classList.toggle("dark", settings.theme === "dark");
  root.style.setProperty("--widget-opacity", String(opacity / 100));
  body.classList.toggle("widget-effect-disabled", !settings.window_effect_enabled);
  await i18n.changeLanguage(settings.language);
}
