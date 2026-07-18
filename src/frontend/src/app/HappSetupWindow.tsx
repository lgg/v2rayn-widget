import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FolderSearch, RefreshCcw, Save, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  closeWindow,
  detectHappPath,
  getHappDiagnostics,
  getSettings,
  updateHappSettings,
  validateHappPath
} from "@/lib/api";
import type { AppSettings, ClientDiagnostics, StatusLevel, TransportMode } from "@/lib/types";

function backendMessage(cause: unknown, fallback: string, translate: (key: string) => string): string {
  const raw = cause instanceof Error ? cause.message : String(cause ?? "");
  if (raw.startsWith("HAPP_UI_AUTOMATION_PROBE_REQUIRED")) {
    return translate("happSetup.probeRequired");
  }
  if (raw.startsWith("settings.")) {
    return translate(raw);
  }
  return raw.trim().length > 0 ? raw : fallback;
}

function statusLabel(value: StatusLevel, translate: (key: string) => string): string {
  return translate(`status.${value.toLowerCase()}`);
}

function transportLabel(value: TransportMode, translate: (key: string) => string): string {
  return translate(`transport.${value}`);
}

export function HappSetupWindow(): JSX.Element {
  const { t } = useTranslation();
  const translate = (key: string): string => t(key);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState("");
  const [allowUiAutomation, setAllowUiAutomation] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ClientDiagnostics | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void getSettings()
      .then((loaded) => {
        if (!active) {
          return;
        }
        setSettings(loaded);
        setPath(loaded.happ_path ?? "");
        setAllowUiAutomation(loaded.happ_allow_ui_automation);
      })
      .catch((cause) => {
        if (active) {
          setError(backendMessage(cause, t("happSetup.loadFailed"), translate));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [t]);

  const probeReady = diagnostics?.application_running === true
    && diagnostics.window_found
    && diagnostics.action_label !== null
    && diagnostics.action_score !== null;

  const detectPath = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setMessage(null);
    setDiagnostics(null);
    try {
      const detected = await detectHappPath();
      if (detected) {
        setPath(detected);
        setMessage(t("happSetup.pathDetected"));
      } else {
        setError(t("happSetup.pathNotDetected"));
      }
    } catch (cause) {
      setError(backendMessage(cause, t("happSetup.detectFailed"), translate));
    } finally {
      setBusy(false);
    }
  };

  const save = async (): Promise<void> => {
    if (!settings) {
      return;
    }

    const controlRequiresProbe = allowUiAutomation
      && (!settings.happ_allow_ui_automation || path.trim() !== (settings.happ_path ?? ""));
    if (controlRequiresProbe && !probeReady) {
      setError(t("happSetup.probeRequired"));
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const trimmed = path.trim();
      let normalizedPath: string | null = null;
      if (trimmed.length > 0) {
        const validation = await validateHappPath(trimmed);
        if (!validation.is_valid) {
          setError(t(validation.message_key));
          return;
        }
        normalizedPath = validation.normalized_path;
      }

      const saved = await updateHappSettings({
        happ_path: normalizedPath,
        happ_allow_ui_automation: allowUiAutomation
      });
      setSettings(saved);
      setPath(saved.happ_path ?? "");
      setAllowUiAutomation(saved.happ_allow_ui_automation);
      setMessage(t("happSetup.saved"));
    } catch (cause) {
      setError(backendMessage(cause, t("errors.settingsSaveFailed"), translate));
    } finally {
      setBusy(false);
    }
  };

  const probe = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await getHappDiagnostics();
      setDiagnostics(result);
      if (result.action_label === null || result.action_score === null) {
        setError(t("happSetup.probeNoAction"));
      }
    } catch (cause) {
      setDiagnostics(null);
      setError(backendMessage(cause, t("happSetup.probeFailed"), translate));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="drag-region flex h-full items-center justify-center text-sm text-muted">
        {t("common.loading")}
      </main>
    );
  }

  if (!settings) {
    return (
      <main data-tauri-drag-region className="drag-region h-full p-4">
        <section className="glass flex h-full flex-col items-center justify-center gap-4 rounded-3xl border p-5 text-center">
          <p className="text-sm text-rose-300">{error ?? t("happSetup.loadFailed")}</p>
          <button type="button" className="no-drag rounded-lg border px-3 py-2" onClick={() => void closeWindow("happ-setup")}>{t("common.close")}</button>
        </section>
      </main>
    );
  }

  return (
    <main data-tauri-drag-region className="drag-region h-full p-0">
      <section className="glass flex h-full flex-col overflow-hidden rounded-3xl border border-white/40 p-4 dark:border-slate-700/80">
        <header className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("happSetup.title")}</h2>
            <p className="text-xs text-muted">{t("happSetup.subtitle")}</p>
          </div>
          <button
            type="button"
            aria-label={t("common.close")}
            className="no-drag rounded-lg p-2 hover:bg-white/50 dark:hover:bg-slate-800"
            onClick={() => void closeWindow("happ-setup")}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="no-drag min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 text-sm">
          <fieldset className="space-y-3 rounded-xl border bg-white/70 p-3 dark:bg-slate-900/70">
            <legend className="px-1 font-medium text-muted">{t("happSetup.executable")}</legend>
            <input
              aria-label={t("happSetup.pathLabel")}
              className="w-full rounded-xl border bg-white/90 px-3 py-2 dark:bg-slate-900/90"
              value={path}
              placeholder="C:\\Path\\To\\Happ.exe"
              onChange={(event) => {
                setPath(event.target.value);
                setDiagnostics(null);
                if (!settings.happ_allow_ui_automation) {
                  setAllowUiAutomation(false);
                }
              }}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border px-2 py-1"
                onClick={() => void detectPath()}
              >
                <FolderSearch className="mr-1 inline h-4 w-4" />
                {t("settings.detectPath")}
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border px-2 py-1"
                onClick={() => {
                  setPath("");
                  setDiagnostics(null);
                  if (!settings.happ_allow_ui_automation) {
                    setAllowUiAutomation(false);
                  }
                }}
              >
                {t("happSetup.useAutoPath")}
              </button>
            </div>
            <p className="text-xs text-muted">{t("happSetup.pathHelp")}</p>
          </fieldset>

          <fieldset className="space-y-3 rounded-xl border border-amber-400/50 bg-amber-50/80 p-3 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
            <legend className="px-1 font-medium">{t("happSetup.experimentalControl")}</legend>
            <div className="flex gap-2 text-xs leading-5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t("happSetup.experimentalWarning")}</p>
            </div>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={allowUiAutomation}
                disabled={busy || (!allowUiAutomation && !probeReady)}
                onChange={(event) => setAllowUiAutomation(event.target.checked)}
              />
              <span>{t("happSetup.enableUiAutomation")}</span>
            </label>
            {!allowUiAutomation && !probeReady && (
              <p className="text-xs">{t("happSetup.probeBeforeEnable")}</p>
            )}
          </fieldset>

          <fieldset className="space-y-3 rounded-xl border bg-white/70 p-3 dark:bg-slate-900/70">
            <legend className="px-1 font-medium text-muted">{t("happSetup.diagnostics")}</legend>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border px-2 py-1"
              onClick={() => void probe()}
            >
              <RefreshCcw className="mr-1 inline h-4 w-4" />
              {t("happSetup.runProbe")}
            </button>

            {diagnostics && (
              <div className="space-y-1 rounded-lg border bg-black/5 p-2 text-xs dark:bg-white/5">
                <p>{t("happSetup.running")}: {diagnostics.application_running ? t("common.yes") : t("common.no")}</p>
                <p>PID: {diagnostics.process_id ?? t("common.notAvailable")}</p>
                <p>{t("happSetup.pathLabel")}: {diagnostics.executable_path ?? t("common.notAvailable")}</p>
                <p>{t("happSetup.window")}: {diagnostics.window_title ?? t("common.notAvailable")}</p>
                <p>{t("fields.connection")}: {statusLabel(diagnostics.connection_state, translate)}</p>
                <p>{t("happSetup.transport")}: {transportLabel(diagnostics.transport_mode, translate)}</p>
                <p>{t("happSetup.action")}: {diagnostics.action_label ?? t("common.notAvailable")}</p>
                <p>{t("happSetup.confidence")}: {diagnostics.action_score ?? t("common.notAvailable")}</p>
                <p className="pt-1 text-muted">{diagnostics.note}</p>
                {diagnostics.ui_nodes.length > 0 && (
                  <details className="pt-1">
                    <summary className="cursor-pointer">{t("happSetup.uiTree")}</summary>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[10px] leading-4">
                      {diagnostics.ui_nodes.join("\n")}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </fieldset>

          {message && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-500/10 p-3 text-xs">
              <CheckCircle2 className="h-4 w-4" />
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-rose-400/50 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-200">
              {error}
            </div>
          )}
        </div>

        <footer className="no-drag mt-3">
          <button
            type="button"
            disabled={busy}
            className="w-full rounded-xl bg-accent px-3 py-2 font-medium text-white disabled:opacity-60"
            onClick={() => void save()}
          >
            <Save className="mr-2 inline h-4 w-4" />
            {t("common.save")}
          </button>
        </footer>
      </section>
    </main>
  );
}
