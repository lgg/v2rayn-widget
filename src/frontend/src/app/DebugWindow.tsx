import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTranslation } from "react-i18next";
import {
  closeWindow,
  debugCaptureRuntimeSnapshot,
  debugClickReloadViaUi,
  debugSelectProfileViaUi,
  debugToggleViaConfigOnly,
  debugToggleViaUiOnly,
  openV2RayN,
  refreshStatus,
  relaunchWidgetAsAdmin,
  runUiDebugProbe,
  toggleTunViaUi
} from "@/lib/api";
import type { DebugRuntimeSnapshot, UiDebugReport } from "@/lib/types";

const debugWindow = getCurrentWindow();

async function closeDebugWindow(): Promise<void> {
  try {
    await closeWindow("debug");
  } catch {
    await debugWindow.hide();
  }
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
  const [log, setLog] = useState<string[]>([]);
  const [profileNameInput, setProfileNameInput] = useState("");

  const append = (line: string): void => {
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 220));
  };

  const captureSnapshot = async (label: string): Promise<void> => {
    try {
      const snapshot = await debugCaptureRuntimeSnapshot();
      append(`${label}: ${formatSnapshot(snapshot)}`);
    } catch (error) {
      append(`${label}: snapshot failed (${error instanceof Error ? error.message : String(error)})`);
    }
  };

  const run = async (
    title: string,
    fn: () => Promise<unknown>,
    options?: { captureSnapshot?: boolean; refreshProbe?: boolean }
  ): Promise<void> => {
    setBusy(true);
    const withSnapshot = options?.captureSnapshot ?? true;

    try {
      append(`RUN ${title}`);
      if (withSnapshot) {
        await captureSnapshot("before");
      }

      const result = await fn();
      append(`OK ${title}: ${typeof result === "string" ? result : "done"}`);

      if (withSnapshot) {
        await captureSnapshot("after");
      }

      if (options?.refreshProbe) {
        const refreshed = await runUiDebugProbe();
        setReport(refreshed);
      }
    } catch (error) {
      append(`ERR ${title}: ${error instanceof Error ? error.message : String(error)}`);
      if (withSnapshot) {
        await captureSnapshot("after_err");
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void run(
      "probe",
      async () => {
        const result = await runUiDebugProbe();
        setReport(result);
        return "probe complete";
      },
      { captureSnapshot: true }
    );
  }, []);

  return (
    <main data-tauri-drag-region className="drag-region h-full p-0">
      <section className="glass flex h-full flex-col overflow-hidden rounded-3xl border border-white/40 p-4 dark:border-slate-700/80">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("debug.title")}</h2>
          <button className="no-drag rounded-lg border px-2 py-1" onClick={() => void closeDebugWindow()}>
            {t("common.close")}
          </button>
        </header>

        <div className="no-drag mb-3 grid grid-cols-2 gap-2 text-xs">
          <button className="rounded-lg border px-2 py-2" disabled={busy} onClick={() => void run("open_v2rayn", openV2RayN)}>
            {t("debug.openV2Rayn")}
          </button>
          <button
            className="rounded-lg border px-2 py-2"
            disabled={busy}
            onClick={() =>
              void run(
                "probe",
                async () => {
                  const result = await runUiDebugProbe();
                  setReport(result);
                  return result.note;
                },
                { captureSnapshot: true }
              )
            }
          >
            {t("debug.probe")}
          </button>
          <button
            className="rounded-lg border px-2 py-2"
            disabled={busy}
            onClick={() => void run("click_enable_tun", debugToggleViaUiOnly, { refreshProbe: true })}
          >
            {t("debug.toggleUiOnly")}
          </button>
          <button
            className="rounded-lg border px-2 py-2"
            disabled={busy}
            onClick={() => void run("click_reload", debugClickReloadViaUi, { refreshProbe: true })}
          >
            {t("debug.clickReload")}
          </button>
          <div className="col-span-2 grid grid-cols-[1fr_auto] gap-2">
            <input
              className="rounded-lg border bg-transparent px-2 py-2"
              disabled={busy}
              value={profileNameInput}
              onChange={(event) => setProfileNameInput(event.target.value)}
              placeholder={t("debug.profileNamePlaceholder")}
            />
            <button
              className="rounded-lg border px-3 py-2"
              disabled={busy || profileNameInput.trim().length === 0}
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
          <button className="rounded-lg border px-2 py-2" disabled={busy} onClick={() => void run("toggle_config_only", debugToggleViaConfigOnly)}>
            {t("debug.toggleConfigOnly")}
          </button>
          <button className="rounded-lg border px-2 py-2" disabled={busy} onClick={() => void run("toggle_full", toggleTunViaUi, { refreshProbe: true })}>
            {t("debug.toggleFull")}
          </button>
          <button className="rounded-lg border px-2 py-2" disabled={busy} onClick={() => void run("refresh", refreshStatus)}>
            {t("debug.refresh")}
          </button>
          <button className="rounded-lg border px-2 py-2" disabled={busy} onClick={() => void run("relaunch_admin", relaunchWidgetAsAdmin, { captureSnapshot: false })}>
            {t("actions.relaunchAdmin")}
          </button>
        </div>

        <div className="no-drag grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-hidden">
          <section className="overflow-y-auto rounded-xl border bg-white/70 p-3 text-xs dark:bg-slate-900/70">
            <p className="font-semibold">{t("debug.probeResult")}</p>
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
                <ul className="list-disc pl-4">
                  {report.tun_candidates.map((item, idx) => (
                    <li key={`${item}-${idx}`} className="break-all">
                      {item}
                    </li>
                  ))}
                </ul>

                <p className="mt-3 font-semibold">reload candidates:</p>
                <ul className="list-disc pl-4">
                  {report.reload_candidates.map((item, idx) => (
                    <li key={`${item}-${idx}`} className="break-all">
                      {item}
                    </li>
                  ))}
                </ul>

                <p className="mt-3 font-semibold">UIA dump ({report.uia_nodes.length}):</p>
                <ul className="list-disc pl-4">
                  {report.uia_nodes.map((item, idx) => (
                    <li key={`${item.automation_id ?? "-"}-${idx}`} className="break-all">
                      {`${item.control_type} | ${item.name ?? "-"} | id=${item.automation_id ?? "-"} | class=${item.class_name ?? "-"} | bounds=${item.bounds ?? "-"}`}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2">{t("common.loading")}</p>
            )}
          </section>

          <section className="overflow-y-auto rounded-xl border bg-white/70 p-3 text-xs dark:bg-slate-900/70">
            <p className="font-semibold">{t("debug.log")}</p>
            <div className="mt-2 space-y-1 font-mono">
              {log.map((line, idx) => (
                <p key={`${line}-${idx}`} className="break-all">
                  {line}
                </p>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}



