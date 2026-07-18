import { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Bug, Check, FolderCheck, Globe, Languages, MoonStar, Shield, SlidersHorizontal, Sun, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  applyUiSettings,
  closeWindow,
  detectV2RayNPath,
  getAvailableLocales,
  getSettings,
  openDebugWindow,
  relaunchWidgetAsAdmin,
  updateSettings,
  validateV2RayNPath
} from "@/lib/api";
import type { AppSettings, LocaleInfo, UiSettingsPatch } from "@/lib/types";

const APP_VERSION = "1.0.0";
const GITHUB_URL = "https://github.com/lgg/v2rayn-widget";

const DEFAULT_CONNECTIVITY_ENDPOINTS = [
  "https://www.msftconnecttest.com/connecttest.txt",
  "https://www.gstatic.com/generate_204",
  "https://www.cloudflare.com/cdn-cgi/trace"
];

const DEFAULT_IP_ENDPOINTS = ["https://api.ipify.org?format=json", "https://ifconfig.me/ip", "https://icanhazip.com"];
const DEFAULT_DIAGNOSTICS_URL = "https://ipleak.net/";

const settingsWindow = getCurrentWindow();

async function closeSettingsWindow(): Promise<void> {
  try {
    await closeWindow("settings");
  } catch {
    await settingsWindow.hide();
  }
}


function parseLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function linesToText(lines: string[]): string {
  return lines.join("\n");
}

function normalizeDiagnosticsUrl(value: string): string | null {
  const trimmed = value.trim();
  const candidate = trimmed.length > 0 ? trimmed : DEFAULT_DIAGNOSTICS_URL;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`;

  try {
    const parsed = new URL(withScheme);
    if ((parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.hostname.length > 0) {
      return parsed.href;
    }
  } catch {
    return null;
  }

  return null;
}

function applyTheme(theme: AppSettings["theme"]): void {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function applyVisual(settings: AppSettings): void {
  const root = document.documentElement;
  const body = document.body;
  const opacity = Math.max(10, Math.min(100, settings.window_opacity_percent));
  root.style.setProperty("--widget-opacity", `${opacity / 100}`);
  body.classList.toggle("widget-effect-disabled", !settings.window_effect_enabled);
}

export function mergeUiFields(prev: AppSettings, next: AppSettings): AppSettings {
  return {
    ...prev,
    // These values are owned by other windows or live runtime tracking and must
    // always follow the newest backend event, even while this window has an
    // unrelated unsaved draft.
    selected_client: next.selected_client,
    happ_path: next.happ_path,
    happ_allow_ui_automation: next.happ_allow_ui_automation,
    window_position: next.window_position,
    language: next.language,
    theme: next.theme,
    always_on_top: next.always_on_top,
    time_format: next.time_format,
    show_clock: next.show_clock,
    show_info_status: next.show_info_status,
    show_external_ip: next.show_external_ip,
    show_latency: next.show_latency,
    mock_mode_enabled: next.mock_mode_enabled,
    show_action_buttons: next.show_action_buttons,
    show_profile_selector: next.show_profile_selector,
    window_effect_enabled: next.window_effect_enabled,
    window_opacity_percent: next.window_opacity_percent
  };
}

export function SettingsWindow(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [locales, setLocales] = useState<LocaleInfo[]>([]);
  const [pathValidation, setPathValidation] = useState<string>("");
  const [connectivityEndpointsText, setConnectivityEndpointsText] = useState<string>("");
  const [ipEndpointsText, setIpEndpointsText] = useState<string>("");
  const [pollError, setPollError] = useState<string | null>(null);
  const [pathError, setPathError] = useState<string | null>(null);
  const [diagnosticsUrlError, setDiagnosticsUrlError] = useState<string | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const draftDirtyRef = useRef(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  const updateDraftDirty = (value: boolean): void => {
    draftDirtyRef.current = value;
    setDraftDirty(value);
  };

  useEffect(() => {
    const load = async (): Promise<void> => {
      const [nextSettings, nextLocales] = await Promise.all([getSettings(), getAvailableLocales()]);
      setSettings(nextSettings);
      setLocales(nextLocales);
      setConnectivityEndpointsText(linesToText(nextSettings.connectivity_endpoints));
      setIpEndpointsText(linesToText(nextSettings.ip_endpoints));
      applyTheme(nextSettings.theme);
      applyVisual(nextSettings);
      await i18n.changeLanguage(nextSettings.language);
      setLoading(false);
    };

    void load();
  }, [i18n]);

  useEffect(() => {
    const bind = async (): Promise<(() => void) | undefined> => {
      const unlisten = await listen<AppSettings>("settings-updated", async (event) => {
        setSettings((prev) => {
          if (!prev) {
            return event.payload;
          }

          return draftDirtyRef.current ? mergeUiFields(prev, event.payload) : event.payload;
        });
        if (!draftDirtyRef.current) {
          setConnectivityEndpointsText(linesToText(event.payload.connectivity_endpoints));
          setIpEndpointsText(linesToText(event.payload.ip_endpoints));
        }
        applyTheme(event.payload.theme);
        applyVisual(event.payload);
        await i18n.changeLanguage(event.payload.language);
      });
      return unlisten;
    };

    let dispose: (() => void) | undefined;
    void bind().then((unlisten) => {
      dispose = unlisten;
    });

    return () => dispose?.();
  }, [i18n]);

  const pathIsManual = settings?.v2rayn_path_mode === "manual";

  const uiPatchBase = useMemo<UiSettingsPatch>(() => {
    if (!settings) {
      return {};
    }

    return {
      language: settings.language,
      theme: settings.theme,
      always_on_top: settings.always_on_top,
      time_format: settings.time_format,
      show_clock: settings.show_clock,
      show_info_status: settings.show_info_status,
      show_external_ip: settings.show_external_ip,
      show_latency: settings.show_latency,
      mock_mode_enabled: settings.mock_mode_enabled,
      show_action_buttons: settings.show_action_buttons,
      show_profile_selector: settings.show_profile_selector,
      window_effect_enabled: settings.window_effect_enabled,
      window_opacity_percent: settings.window_opacity_percent
    };
  }, [settings]);

  const applyUi = async (patch: UiSettingsPatch): Promise<void> => {
    if (!settings) {
      return;
    }

    const merged = { ...uiPatchBase, ...patch };
    const saved = await applyUiSettings(merged);

    setSettings((prev) => (prev ? mergeUiFields(prev, saved) : saved));
    applyTheme(saved.theme);
    applyVisual(saved);
    await i18n.changeLanguage(saved.language);
  };

  const onSave = async (): Promise<void> => {
    if (!settings) {
      return;
    }

    setBusy(true);
    setPollError(null);
    setPathError(null);
    setDiagnosticsUrlError(null);
    try {
      const pollValue = Number(settings.poll_interval_sec);
      if (!Number.isFinite(pollValue) || pollValue < 1 || pollValue > 3600) {
        setPollError(t("settings.pollInvalid"));
        return;
      }

      let normalizedPath = settings.v2rayn_path?.trim() ?? "";
      if (settings.v2rayn_path_mode === "manual") {
        if (!normalizedPath) {
          setPathError(t("settings.pathEmpty"));
          return;
        }

        const validation = await validateV2RayNPath(normalizedPath);
        normalizedPath = validation.normalized_path;
        if (!validation.is_valid) {
          setPathError(t(validation.message_key));
          setPathValidation(t(validation.message_key));
          return;
        }

        setPathValidation(t(validation.message_key));
      }

      const diagnosticsUrl = normalizeDiagnosticsUrl(settings.diagnostics_url);
      if (!diagnosticsUrl) {
        setDiagnosticsUrlError(t("settings.diagnosticsUrlInvalid"));
        return;
      }

      const next: AppSettings = {
        ...settings,
        poll_interval_sec: Math.min(3600, Math.max(1, Math.round(pollValue))),
        window_opacity_percent: Math.min(100, Math.max(10, Math.round(settings.window_opacity_percent))),
        diagnostics_url: diagnosticsUrl,
        connectivity_endpoints: parseLines(connectivityEndpointsText),
        ip_endpoints: parseLines(ipEndpointsText),
        v2rayn_path: settings.v2rayn_path_mode === "manual" ? normalizedPath : null
      };

      const saved = await updateSettings(next);
      setSettings(saved);
      updateDraftDirty(false);
      await closeSettingsWindow();
    } finally {
      setBusy(false);
    }
  };

  const requestClose = async (): Promise<void> => {
    if (draftDirty) {
      setConfirmDiscardOpen(true);
      return;
    }

    await closeSettingsWindow();
  };

  const discardAndClose = async (): Promise<void> => {
    setConfirmDiscardOpen(false);
    updateDraftDirty(false);
    await closeSettingsWindow();
  };

  if (loading || !settings) {
    return (
      <main data-tauri-drag-region className="drag-region h-full">
        <div className="flex h-full items-center justify-center text-sm text-muted">{t("common.loading")}</div>
      </main>
    );
  }

  return (
    <main data-tauri-drag-region className="drag-region h-full p-0">
      <section className="glass flex h-full flex-col overflow-hidden rounded-3xl border border-white/40 p-4 dark:border-slate-700/80">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("settings.title")}</h2>
          <button
            type="button"
            aria-label={t("common.close")}
            className="no-drag rounded-lg p-2 hover:bg-white/50 dark:hover:bg-slate-800"
            onClick={() => void requestClose()}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="no-drag min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {confirmDiscardOpen && (
            <section
              role="alert"
              className="rounded-xl border border-amber-300 bg-amber-50/90 p-3 text-sm text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100"
            >
              <p className="font-medium">{t("settings.unsavedTitle")}</p>
              <p className="mt-1 text-xs">{t("settings.unsavedMessage")}</p>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" className="rounded-lg border px-2 py-1 text-xs" onClick={() => setConfirmDiscardOpen(false)}>
                  {t("settings.keepEditing")}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-amber-600 px-2 py-1 text-xs font-medium text-white"
                  onClick={() => void discardAndClose()}
                >
                  {t("settings.discardChanges")}
                </button>
              </div>
            </section>
          )}

          <label className="block space-y-1">
            <span className="flex items-center gap-2 font-medium text-muted">
              <Languages className="h-4 w-4" />
              {t("settings.language")}
            </span>
            <select
              className="w-full rounded-xl border bg-white/80 px-3 py-2 dark:bg-slate-900/80"
              value={settings.language}
              onChange={(event) => {
                const language = event.target.value;
                setSettings((prev) => (prev ? { ...prev, language } : prev));
                void applyUi({ language });
              }}
            >
              {locales.map((locale) => (
                <option key={locale.code} value={locale.code}>
                  {locale.native_label} ({locale.label})
                </option>
              ))}
            </select>
          </label>

          <fieldset className="space-y-2">
            <legend className="font-medium text-muted">{t("settings.theme")}</legend>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-xl border bg-white/80 px-3 py-2 dark:bg-slate-900/80"
                onClick={() => {
                  setSettings((prev) => (prev ? { ...prev, theme: "light" } : prev));
                  void applyUi({ theme: "light" });
                }}
              >
                <Sun className="mr-2 inline h-4 w-4" />
                {t("settings.light")}
                {settings.theme === "light" && <Check className="ml-2 inline h-4 w-4" />}
              </button>
              <button
                type="button"
                className="rounded-xl border bg-white/80 px-3 py-2 dark:bg-slate-900/80"
                onClick={() => {
                  setSettings((prev) => (prev ? { ...prev, theme: "dark" } : prev));
                  void applyUi({ theme: "dark" });
                }}
              >
                <MoonStar className="mr-2 inline h-4 w-4" />
                {t("settings.dark")}
                {settings.theme === "dark" && <Check className="ml-2 inline h-4 w-4" />}
              </button>
            </div>
          </fieldset>

          <fieldset className="space-y-2 rounded-xl border bg-white/70 p-3 dark:bg-slate-900/70">
            <legend className="px-1 text-sm font-medium text-muted">{t("settings.uiSection")}</legend>

            <label className="flex items-center justify-between">
              <span>{t("settings.alwaysOnTop")}</span>
              <input
                type="checkbox"
                checked={settings.always_on_top}
                onChange={(event) => {
                  const value = event.target.checked;
                  setSettings((prev) => (prev ? { ...prev, always_on_top: value } : prev));
                  void applyUi({ always_on_top: value });
                }}
              />
            </label>

            <label className="block space-y-1">
              <span>{t("settings.timeFormat")}</span>
              <select
                className="w-full rounded-xl border bg-white/90 px-3 py-2 dark:bg-slate-900/90"
                value={settings.time_format}
                onChange={(event) => {
                  const value = event.target.value as AppSettings["time_format"];
                  setSettings((prev) => (prev ? { ...prev, time_format: value } : prev));
                  void applyUi({ time_format: value });
                }}
              >
                <option value="system">{t("settings.timeSystem")}</option>
                <option value="24h">{t("settings.time24")}</option>
                <option value="12h">{t("settings.time12")}</option>
              </select>
            </label>

            {[
              ["settings.showClock", "show_clock"],
              ["settings.showInfoStatus", "show_info_status"],
              ["settings.showProfileSelector", "show_profile_selector"],
              ["settings.showActionButtons", "show_action_buttons"],
              ["settings.showExternalIp", "show_external_ip"],
              ["settings.showLatency", "show_latency"],
              ["settings.mockMode", "mock_mode_enabled"]
            ].map(([label, key]) => (
              <label key={key} className="flex items-center justify-between">
                <span>{t(label)}</span>
                <input
                  type="checkbox"
                  checked={Boolean(settings[key as keyof AppSettings])}
                  onChange={(event) => {
                    const value = event.target.checked;
                    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
                    void applyUi({ [key]: value } as UiSettingsPatch);
                  }}
                />
              </label>
            ))}

            <label className="flex items-center justify-between">
              <span>{t("settings.windowEffectEnabled")}</span>
              <input
                type="checkbox"
                checked={settings.window_effect_enabled}
                onChange={(event) => {
                  const value = event.target.checked;
                  setSettings((prev) => (prev ? { ...prev, window_effect_enabled: value } : prev));
                  void applyUi({ window_effect_enabled: value });
                }}
              />
            </label>

            <label className="block space-y-1">
              <span className="flex items-center gap-2 text-muted">
                <SlidersHorizontal className="h-4 w-4" />
                {t("settings.windowOpacity")}: {settings.window_opacity_percent}%
              </span>
              <input
                type="range"
                min={10}
                max={100}
                step={1}
                value={settings.window_opacity_percent}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  setSettings((prev) => (prev ? { ...prev, window_opacity_percent: value } : prev));
                  void applyUi({ window_opacity_percent: value });
                }}
                className="w-full"
              />
            </label>
          </fieldset>

          <fieldset className="space-y-2 rounded-xl border bg-white/70 p-3 dark:bg-slate-900/70">
            <legend className="px-1 text-sm font-medium text-muted">{t("settings.appSection")}</legend>

            <label className="flex items-center justify-between">
              <span>{t("settings.autostart")}</span>
              <input
                type="checkbox"
                checked={settings.autostart_with_windows}
                onChange={(event) => {
                  updateDraftDirty(true);
                  setSettings((prev) => (prev ? { ...prev, autostart_with_windows: event.target.checked } : prev));
                }}
              />
            </label>

            <label className="flex items-center justify-between">
              <span>{t("settings.allowRestartFallback")}</span>
              <input
                type="checkbox"
                checked={settings.allow_restart_fallback}
                onChange={(event) => {
                  updateDraftDirty(true);
                  setSettings((prev) => (prev ? { ...prev, allow_restart_fallback: event.target.checked } : prev));
                }}
              />
            </label>

            <label className="block space-y-1">
              <span>{t("settings.pollInterval")}</span>
              <input
                type="number"
                min={1}
                max={3600}
                step={1}
                className={`w-full rounded-xl border px-3 py-2 dark:bg-slate-900/90 ${pollError ? "border-rose-400 bg-rose-50/80 dark:bg-rose-500/10" : "bg-white/90"}`}
                value={settings.poll_interval_sec}
                onChange={(event) => {
                  setPollError(null);
                  updateDraftDirty(true);
                  const value = Number.parseInt(event.target.value, 10);
                  setSettings((prev) => (prev ? { ...prev, poll_interval_sec: Number.isFinite(value) ? value : 10 } : prev));
                }}
              />
              {pollError && <p className="text-xs text-rose-400">{pollError}</p>}
            </label>
          </fieldset>

          <fieldset className="space-y-2 rounded-xl border bg-white/70 p-3 dark:bg-slate-900/70">
            <legend className="px-1 text-sm font-medium text-muted">{t("settings.diagnosticsSection")}</legend>

            <label className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {t("settings.diagnosticsEnabled")}
              </span>
              <input
                type="checkbox"
                checked={settings.diagnostics_enabled}
                onChange={(event) => {
                  updateDraftDirty(true);
                  setSettings((prev) => (prev ? { ...prev, diagnostics_enabled: event.target.checked } : prev));
                }}
              />
            </label>

            <label className="block space-y-1">
              <span>{t("settings.diagnosticsUrl")}</span>
              <input
                className={`w-full rounded-xl border px-3 py-2 dark:bg-slate-900/90 ${diagnosticsUrlError ? "border-rose-400 bg-rose-50/80 dark:bg-rose-500/10" : "bg-white/90"}`}
                value={settings.diagnostics_url}
                placeholder={DEFAULT_DIAGNOSTICS_URL}
                onChange={(event) => {
                  updateDraftDirty(true);
                  setDiagnosticsUrlError(null);
                  setSettings((prev) => (prev ? { ...prev, diagnostics_url: event.target.value } : prev));
                }}
              />
              {diagnosticsUrlError && <p className="text-xs text-rose-400">{diagnosticsUrlError}</p>}
            </label>
          </fieldset>

          <fieldset className="space-y-3 rounded-xl border bg-white/70 p-3 dark:bg-slate-900/70">
            <legend className="px-1 text-sm font-medium text-muted">{t("settings.networkSection")}</legend>

            <label className="block space-y-1">
              <span>{t("settings.latencyMode")}</span>
              <select
                className="w-full rounded-xl border bg-white/90 px-3 py-2 dark:bg-slate-900/90"
                value={settings.latency_mode}
                onChange={(event) => {
                  updateDraftDirty(true);
                  setSettings((prev) =>
                    prev ? { ...prev, latency_mode: event.target.value as AppSettings["latency_mode"] } : prev
                  );
                }}
              >
                <option value="active">{t("settings.latencyModeActive")}</option>
                <option value="log_snapshot">{t("settings.latencyModeLog")}</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span>{t("settings.connectivityEndpoints")}</span>
              <textarea
                className="min-h-24 w-full resize-y rounded-xl border bg-white/90 px-3 py-2 text-xs leading-5 dark:bg-slate-900/90"
                value={connectivityEndpointsText}
                onChange={(event) => {
                  updateDraftDirty(true);
                  setConnectivityEndpointsText(event.target.value);
                }}
              />
            </label>
            <div className="flex justify-end">
              <button
                type="button"
                className="rounded-lg border px-2 py-1 text-xs"
                onClick={() => {
                  updateDraftDirty(true);
                  setConnectivityEndpointsText(linesToText(DEFAULT_CONNECTIVITY_ENDPOINTS));
                }}
              >
                {t("settings.resetDefaults")}
              </button>
            </div>

            <label className="block space-y-1">
              <span>{t("settings.ipEndpoints")}</span>
              <textarea
                className="min-h-24 w-full resize-y rounded-xl border bg-white/90 px-3 py-2 text-xs leading-5 dark:bg-slate-900/90"
                value={ipEndpointsText}
                onChange={(event) => {
                  updateDraftDirty(true);
                  setIpEndpointsText(event.target.value);
                }}
              />
            </label>
            <div className="flex justify-end">
              <button
                type="button"
                className="rounded-lg border px-2 py-1 text-xs"
                onClick={() => {
                  updateDraftDirty(true);
                  setIpEndpointsText(linesToText(DEFAULT_IP_ENDPOINTS));
                }}
              >
                {t("settings.resetDefaults")}
              </button>
            </div>
          </fieldset>

          <fieldset className="space-y-2 rounded-xl border bg-white/70 p-3 dark:bg-slate-900/70">
            <legend className="px-1 text-sm font-medium text-muted">{t("settings.v2raynPath")}</legend>

            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={settings.v2rayn_path_mode === "auto"}
                onChange={() => {
                  updateDraftDirty(true);
                  setPathError(null);
                  setSettings((prev) => (prev ? { ...prev, v2rayn_path_mode: "auto", v2rayn_path: null } : prev));
                }}
              />
              <span>{t("settings.pathModeAuto")}</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={settings.v2rayn_path_mode === "manual"}
                onChange={() => {
                  updateDraftDirty(true);
                  setPathError(null);
                  setSettings((prev) => (prev ? { ...prev, v2rayn_path_mode: "manual" } : prev));
                }}
              />
              <span>{t("settings.pathModeManual")}</span>
            </label>

            <input
              className={`w-full rounded-xl border px-3 py-2 disabled:opacity-60 dark:bg-slate-900/90 ${pathError ? "border-rose-400 bg-rose-50/80 dark:bg-rose-500/10" : "bg-white/90"}`}
              disabled={!pathIsManual}
              value={settings.v2rayn_path ?? ""}
              placeholder={t("settings.pathPlaceholder")}
              onChange={(event) => {
                updateDraftDirty(true);
                setPathError(null);
                setSettings((prev) => (prev ? { ...prev, v2rayn_path: event.target.value } : prev));
              }}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border px-2 py-1"
                onClick={async () => {
                  const detected = await detectV2RayNPath();
                  if (detected) {
                    updateDraftDirty(true);
                    setSettings((prev) => (prev ? { ...prev, v2rayn_path_mode: "manual", v2rayn_path: detected } : prev));
                    setPathValidation(t("settings.pathDetected"));
                  } else {
                    setPathValidation(t("settings.pathNotDetected"));
                  }
                }}
              >
                <FolderCheck className="mr-1 inline h-4 w-4" />
                {t("settings.detectPath")}
              </button>

              <button
                type="button"
                className="rounded-lg border px-2 py-1"
                onClick={async () => {
                  const path = settings.v2rayn_path?.trim() ?? "";
                  if (!path) {
                    setPathError(t("settings.pathEmpty"));
                    setPathValidation(t("settings.pathEmpty"));
                    return;
                  }
                  const result = await validateV2RayNPath(path);
                  updateDraftDirty(true);
                  setSettings((prev) => (prev ? { ...prev, v2rayn_path: result.normalized_path } : prev));
                  setPathValidation(t(result.message_key));
                  if (!result.is_valid) {
                    setPathError(t(result.message_key));
                  } else {
                    setPathError(null);
                  }
                }}
              >
                {t("settings.validatePath")}
              </button>

              <button
                type="button"
                className="rounded-lg border px-2 py-1"
                onClick={() => {
                  updateDraftDirty(true);
                  setPathError(null);
                  setSettings((prev) => (prev ? { ...prev, v2rayn_path_mode: "auto", v2rayn_path: null } : prev));
                  setPathValidation(t("settings.pathAutoMode"));
                }}
              >
                {t("settings.resetAuto")}
              </button>
            </div>

            <p className="text-xs text-muted">{pathValidation || t("settings.pathHelp")}</p>
            {pathError && <p className="text-xs text-rose-400">{pathError}</p>}
          </fieldset>

          <section className="rounded-xl border bg-white/70 p-3 text-xs text-muted dark:bg-slate-900/70">
            <p className="font-medium text-foreground">{t("settings.about")}</p>
            <p className="mt-1">
              {t("settings.version")}: {APP_VERSION}
            </p>
            <p className="mt-1">
              {t("settings.github")}: {" "}
              <a className="underline underline-offset-2" href={GITHUB_URL} target="_blank" rel="noreferrer">
                {GITHUB_URL}
              </a>
            </p>

            <hr className="my-3 border-white/20" />

            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-lg border px-2 py-1" onClick={() => void openDebugWindow()}>
                <Bug className="mr-1 inline h-4 w-4" />
                {t("actions.openDebugTools")}
              </button>
              <button type="button" className="rounded-lg border px-2 py-1" onClick={() => void relaunchWidgetAsAdmin()}>
                <Shield className="mr-1 inline h-4 w-4" />
                {t("actions.relaunchAdmin")}
              </button>
            </div>
          </section>
        </div>

        <footer className="no-drag mt-3">
          <button type="button" disabled={busy} className="w-full rounded-xl bg-accent px-3 py-2 font-medium text-white" onClick={() => void onSave()}>
            {t("common.save")}
          </button>
        </footer>
      </section>
    </main>
  );
}












