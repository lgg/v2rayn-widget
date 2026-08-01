import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  closeWindow,
  debugCaptureRuntimeSnapshot,
  debugClickReloadViaUi,
  debugSelectProfileViaUi,
  debugToggleViaConfigOnly,
  debugToggleViaUiOnly,
  getSettings,
  openV2RayN,
  refreshStatus,
  relaunchWidgetAsAdmin,
  runUiDebugProbe,
  toggleTunViaUi
} from "@/lib/api";
import { applySurfaceSettings } from "@/lib/surface-settings";
import { bindTauriListener } from "@/lib/tauri-listener";
import type { AppSettings, DebugRuntimeSnapshot, ProxyClientId, UiDebugReport } from "@/lib/types";

async function closeDebugWindow(): Promise<void> {
  await closeWindow("debug");
}

function formatSnapshot(snapshot: DebugRuntimeSnapshot): string {
  const tunValue = snapshot.enable_tun === null ? "n/a" : String(snapshot.enable_tun);
  const profile = snapshot.active_profile_name ?? "-";
  const pid = snapshot.v2rayn_pid ?? "-";
  const lastEvent = snapshot.last_event ?? "-";

  return `tun=${tunValue} profile=${profile} running=${snapshot.v2rayn_running} pid=${pid} event=${lastEvent}`;
}

export function DebugWindow(): JSX.Element {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<UiDebugReport | null>(null);
  const [initialProbePending, setInitialProbePending] = useState(true);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [profileNameInput, setProfileNameInput] = useState("");
  const settingsRevisionRef = useRef(0);
  const [settingsListenerSettled, setSettingsListenerSettled] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ProxyClientId | null>(null);
  const selectedClientRef = useRef<ProxyClientId | null>(null);
  const clientRevisionRef = useRef(0);

  const applySelectedClient = (client: ProxyClientId): void => {
    if (selectedClientRef.current !== client) {
      clientRevisionRef.current += 1;
    }
    selectedClientRef.current = client;
    setSelectedClient(client);
    if (client !== "v2rayn") {
      setBusy(false);
      setReport(null);
      setProbeError(null);
      setInitialProbePending(false);
    }
  };

  const append = (line: string): void => {
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 220));
  };

  const captureSnapshot = async (label: string, isCurrent: () => boolean): Promise<void> => {
    try {
      const snapshot = await debugCaptureRuntimeSnapshot();
      if (isCurrent()) append(`${label}: ${formatSnapshot(snapshot)}`);
    } catch (error) {
      if (isCurrent()) {
        append(`${label}: snapshot failed (${error instanceof Error ? error.message : String(error)})`);
      }
    }
  };

  const run = async (
    title: string,
    fn: () => Promise<unknown>,
    options?: { captureSnapshot?: boolean; refreshProbe?: boolean; probeOperation?: boolean }
  ): Promise<boolean> => {
    const operationRevision = clientRevisionRef.current;
    const isCurrent = (): boolean =>
      operationRevision === clientRevisionRef.current && selectedClientRef.current === "v2rayn";
    if (!isCurrent()) return false;

    setBusy(true);
    const withSnapshot = options?.captureSnapshot ?? true;
    if (options?.probeOperation) {
      setProbeError(null);
      setReport(null);
    }

    try {
      append(`RUN ${title}`);
      if (withSnapshot) {
        await captureSnapshot("before", isCurrent);
      }
      if (!isCurrent()) return false;

      const result = await fn();
      if (!isCurrent()) return false;
      append(`OK ${title}: ${typeof result === "string" ? result : "done"}`);
      if (options?.probeOperation) {
        setReport(result as UiDebugReport);
        setProbeError(null);
      }

      if (withSnapshot) {
        await captureSnapshot("after", isCurrent);
      }

      if (options?.refreshProbe) {
        const refreshed = await runUiDebugProbe();
        if (!isCurrent()) return false;
        setReport(refreshed);
        setProbeError(null);
      }
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      const message = error instanceof Error ? error.message : String(error);
      append(`ERR ${title}: ${message}`);
      if (options?.probeOperation || options?.refreshProbe) {
        setProbeError(message.trim() || t("debug.probeFailed"));
      }
      if (withSnapshot) {
        await captureSnapshot("after_err", isCurrent);
      }
      return false;
    } finally {
      if (isCurrent()) setBusy(false);
    }
  };

  useEffect(() => {
    if (!settingsListenerSettled) return;
    let active = true;
    const revision = settingsRevisionRef.current;
    void getSettings()
      .then(async (settings) => {
        if (!active || revision !== settingsRevisionRef.current) return;
        applySelectedClient(settings.selected_client);
        await applySurfaceSettings(settings);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [settingsListenerSettled]);

  useEffect(() => {
    setSettingsListenerSettled(false);
    return bindTauriListener<AppSettings>(
      "settings-updated",
      (event) => {
        settingsRevisionRef.current += 1;
        applySelectedClient(event.payload.selected_client);
        void applySurfaceSettings(event.payload);
      },
      () => setSettingsListenerSettled(true),
      () => setSettingsListenerSettled(true),
    );
  }, []);

  useEffect(() => {
    if (selectedClient === null) return;
    if (selectedClient !== "v2rayn") {
      setReport(null);
      setProbeError(null);
      setInitialProbePending(false);
      return;
    }

    const operationRevision = clientRevisionRef.current;
    setInitialProbePending(true);
    void run(
      "probe",
      runUiDebugProbe,
      { captureSnapshot: true, probeOperation: true }
    ).finally(() => {
      if (operationRevision === clientRevisionRef.current) setInitialProbePending(false);
    });
  }, [selectedClient]);

  useEffect(
    () =>
      bindTauriListener("debug-close-requested", () => {
        void closeDebugWindow();
      }),
    [],
  );

  const debugEnabled = selectedClient === "v2rayn";

  return (
    <main data-tauri-drag-region className="drag-region h-full p-0">
      <section className="glass flex h-full flex-col overflow-hidden rounded-3xl border border-white/40 p-4 dark:border-slate-700/80">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("debug.title")}</h2>
          <button type="button" className="no-drag rounded-lg border px-2 py-1" onClick={() => void closeDebugWindow()}>
            {t("common.close")}
          </button>
        </header>

        {!debugEnabled && selectedClient !== null && (
          <p role="alert" className="no-drag mb-3 rounded-xl border border-amber-400/50 bg-amber-500/10 p-3 text-xs text-amber-100">
            {t("debug.v2raynOnly")}
          </p>
        )}

        <div className="no-drag mb-3 grid grid-cols-2 gap-2 text-xs">
          <button type="button" className="rounded-lg border px-2 py-2" disabled={busy || !debugEnabled} onClick={() => void run("open_v2rayn", openV2RayN)}>
            {t("debug.openV2Rayn")}
          </button>
          <button
            type="button"
            className="rounded-lg border px-2 py-2"
            disabled={busy || !debugEnabled}
            onClick={() =>
              void run(
                "probe",
                runUiDebugProbe,
                { captureSnapshot: true, probeOperation: true }
              )
            }
          >
            {t("debug.probe")}
          </button>
          <button
            type="button"
            className="rounded-lg border px-2 py-2"
            disabled={busy || !debugEnabled}
            onClick={() => void run("click_enable_tun", debugToggleViaUiOnly, { refreshProbe: true })}
          >
            {t("debug.toggleUiOnly")}
          </button>
          <button
            type="button"
            className="rounded-lg border px-2 py-2"
            disabled={busy || !debugEnabled}
            onClick={() => void run("click_reload", debugClickReloadViaUi, { refreshProbe: true })}
          >
            {t("debug.clickReload")}
          </button>
          <div className="col-span-2 grid grid-cols-[1fr_auto] gap-2">
            <input
              aria-label={t("debug.profileNameLabel")}
              className="rounded-lg border bg-transparent px-2 py-2"
              disabled={busy || !debugEnabled}
              value={profileNameInput}
              onChange={(event) => setProfileNameInput(event.target.value)}
              placeholder={t("debug.profileNamePlaceholder")}
            />
            <button
              type="button"
              className="rounded-lg border px-3 py-2"
              disabled={busy || !debugEnabled || profileNameInput.trim().length === 0}
              onClick={() =>
                void run(
                  `select_profile_ui:${profileNameInput.trim()}`,
                  () => debugSelectProfileViaUi(profileNameInput.trim()),
                  { refreshProbe: true }
                )
              }
            >
              {t("debug.selectProfileUi")}
            </button>
          </div>
          <button type="button" className="rounded-lg border px-2 py-2" disabled={busy || !debugEnabled} onClick={() => void run("toggle_config_only", debugToggleViaConfigOnly)}>
            {t("debug.toggleConfigOnly")}
          </button>
          <button type="button" className="rounded-lg border px-2 py-2" disabled={busy || !debugEnabled} onClick={() => void run("toggle_full", toggleTunViaUi, { refreshProbe: true })}>
            {t("debug.toggleFull")}
          </button>
          <button type="button" className="rounded-lg border px-2 py-2" disabled={busy || !debugEnabled} onClick={() => void run("refresh", refreshStatus)}>
            {t("debug.refresh")}
          </button>
          <button type="button" className="rounded-lg border px-2 py-2" disabled={busy || !debugEnabled} onClick={() => void run("relaunch_admin", relaunchWidgetAsAdmin, { captureSnapshot: false })}>
            {t("actions.relaunchAdmin")}
          </button>
        </div>

        <div className="no-drag grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-hidden">
          <section aria-live="polite" className="overflow-y-auto rounded-xl border bg-white/70 p-3 text-xs dark:bg-slate-900/70">
            <p className="font-semibold">{t("debug.probeResult")}</p>
            {probeError && (
              <p role="alert" className="mt-2 text-rose-600 dark:text-rose-300">{probeError}</p>
            )}
            {report ? (
              <>
                <p className="mt-2">window_found: {String(report.window_found)}</p>
                <p>window_title: {report.window_title ?? "-"}</p>
                <p>window_pid: {report.window_pid ?? "-"}</p>
                <p>window_process_name: {report.window_process_name ?? "-"}</p>
                <p>tun_control_found: {String(report.tun_control_found)}</p>
                <p>tun_control_title: {report.tun_control_title ?? "-"}</p>
                <p>reload_control_found: {String(report.reload_control_found)}</p>
                <p>reload_control_title: {report.reload_control_title ?? "-"}</p>
                <p className="mt-2">widget_is_admin: {String(report.privilege.widget_is_admin)}</p>
                <p>v2rayn_pid: {report.privilege.v2rayn_pid ?? "-"}</p>
                <p>v2rayn_is_admin: {String(report.privilege.v2rayn_is_admin)}</p>
                <p>uipi_mismatch: {String(report.privilege.uipi_mismatch)}</p>
                <p className="mt-2">note: {report.note}</p>

                <p className="mt-3 font-semibold">tun candidates:</p>
                {report.tun_candidates.length > 0 ? (
                  <ul className="list-disc pl-4">
                    {report.tun_candidates.map((item, idx) => (
                      <li key={`${item}-${idx}`} className="break-all">{item}</li>
                    ))}
                  </ul>
                ) : <p>{t("common.none")}</p>}

                <p className="mt-3 font-semibold">reload candidates:</p>
                {report.reload_candidates.length > 0 ? (
                  <ul className="list-disc pl-4">
                    {report.reload_candidates.map((item, idx) => (
                      <li key={`${item}-${idx}`} className="break-all">{item}</li>
                    ))}
                  </ul>
                ) : <p>{t("common.none")}</p>}

                <p className="mt-3 font-semibold">UIA dump ({report.uia_nodes.length}):</p>
                {report.uia_nodes.length > 0 ? (
                  <ul className="list-disc pl-4">
                    {report.uia_nodes.map((item, idx) => (
                      <li key={`${item.automation_id ?? "-"}-${idx}`} className="break-all">
                        {`${item.control_type} | ${item.name ?? "-"} | id=${item.automation_id ?? "-"} | class=${item.class_name ?? "-"} | bounds=${item.bounds ?? "-"}`}
                      </li>
                    ))}
                  </ul>
                ) : <p>{t("common.none")}</p>}
              </>
            ) : initialProbePending ? (
              <p role="status" className="mt-2">{t("common.loading")}</p>
            ) : (
              <p className="mt-2">{t("debug.noProbeResult")}</p>
            )}
          </section>

          <section aria-live="polite" className="overflow-y-auto rounded-xl border bg-white/70 p-3 text-xs dark:bg-slate-900/70">
            <p className="font-semibold">{t("debug.log")}</p>
            <div className="mt-2 space-y-1 font-mono">
              {log.length > 0 ? log.map((line, idx) => (
                <p key={`${line}-${idx}`} className="break-all">{line}</p>
              )) : <p>{t("common.none")}</p>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
