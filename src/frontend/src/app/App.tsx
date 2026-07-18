import { useEffect, useMemo, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { Copy, Globe, RefreshCcw, Settings, SquareArrowOutUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ClientSelector } from "@/components/client-selector";
import { ConnectButton } from "@/components/connect-button";
import { InfoPanel } from "@/components/info-panel";
import { ProfileSelector } from "@/components/profile-selector";
import { StatusBadge } from "@/components/status-badge";
import { useDashboardStore } from "@/features/dashboard-store";
import { setMainWindowHeight } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { AppSettings, CapabilityState } from "@/lib/types";

function capabilityAvailable(value: CapabilityState | undefined): boolean {
  return value === "supported" || value === "experimental";
}

export function App(): JSX.Element {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLElement | null>(null);
  const lastMeasuredHeight = useRef<number>(0);

  const {
    bootstrap,
    refresh,
    selectClient,
    toggleConnection,
    setActiveItem,
    status,
    settings,
    clients,
    profiles,
    loading,
    actionLoading,
    notice,
    pathNoticeKey,
    openDiagnostics,
    openSettings,
    openClient,
    relaunchAsAdmin,
    showNotice,
    clearNotice,
    applyExternalSettings
  } = useDashboardStore();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!settings) {
      return;
    }

    const timer = window.setInterval(() => {
      void refresh({ background: true });
    }, settings.poll_interval_sec * 1000);

    return () => window.clearInterval(timer);
  }, [refresh, settings]);

  useEffect(() => {
    if (!settings) {
      return;
    }

    void refresh();
  }, [refresh, settings?.mock_mode_enabled]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => {
      clearNotice();
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [notice, clearNotice]);

  useEffect(() => {
    const setup = async (): Promise<(() => void) | undefined> => {
      const unlisten = await listen<AppSettings>("settings-updated", (event) => {
        applyExternalSettings(event.payload);
      });
      return unlisten;
    };

    let dispose: (() => void) | undefined;
    void setup().then((unlisten) => {
      dispose = unlisten;
    });

    return () => {
      dispose?.();
    };
  }, [applyExternalSettings]);

  const showInfoPanel = useMemo(() => {
    if (!settings) {
      return false;
    }

    return settings.show_info_status || settings.show_clock || settings.show_external_ip || settings.show_latency;
  }, [settings]);

  useEffect(() => {
    if (!settings || loading) {
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    let animationFrame = 0;

    const updateHeight = (): void => {
      const measured = Math.ceil(panel.getBoundingClientRect().height + 16);
      if (Math.abs(measured - lastMeasuredHeight.current) < 2) {
        return;
      }

      lastMeasuredHeight.current = measured;
      void setMainWindowHeight(measured);
    };

    updateHeight();

    const observer = new ResizeObserver(() => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }

      animationFrame = requestAnimationFrame(updateHeight);
    });

    observer.observe(panel);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      observer.disconnect();
    };
  }, [loading, settings, showInfoPanel, notice, status, actionLoading, profiles.length, clients.length]);

  if (loading || !status || !settings) {
    return (
      <main data-tauri-drag-region className="drag-region h-full overflow-hidden text-sm text-muted">
        <div className="flex h-full items-center justify-center">{t("common.loading")}</div>
      </main>
    );
  }

  const selectedClient = clients.find((client) => client.id === settings.selected_client);
  const canToggle = capabilityAvailable(selectedClient?.capabilities.toggle_connection);
  const canListItems = capabilityAvailable(selectedClient?.capabilities.list_items);
  const canSelectItems = capabilityAvailable(selectedClient?.capabilities.select_item);
  const showProfileSelector = settings.show_profile_selector && canListItems;
  const selectedProfileId =
    profiles.find((profile) => profile.name === status.active_profile_name)?.id ?? profiles[0]?.id ?? "";

  const showLowerBlock = showInfoPanel || settings.show_action_buttons;
  const copyIp = async (): Promise<void> => {
    if (!status.external_ip) {
      showNotice({ kind: "error", message: t("errors.copyIpMissing") });
      return;
    }

    try {
      await navigator.clipboard.writeText(status.external_ip);
      showNotice({ kind: "info", message: t("notices.ipCopied") });
    } catch {
      showNotice({ kind: "error", message: t("errors.copyIpFailed") });
    }
  };

  return (
    <main data-tauri-drag-region className="drag-region h-full overflow-hidden p-0">
      <section
        ref={panelRef}
        className="glass relative mx-auto w-full max-w-sm rounded-3xl border border-white/40 p-4 dark:border-slate-700/70"
      >
        {pathNoticeKey && (
          <div className="no-drag mb-3 rounded-xl border border-amber-300/60 bg-amber-100/80 p-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="mb-2">{t(pathNoticeKey)}</p>
            <button
              type="button"
              className="rounded-lg border border-amber-500/40 px-2 py-1 font-medium"
              onClick={() => void openSettings()}
            >
              {t("actions.openSettings")}
            </button>
          </div>
        )}

        <header className="mb-4 grid grid-cols-[1fr_auto] gap-2">
          <div className="min-w-0 rounded-xl border border-white/45 bg-white/70 px-3 py-2 dark:border-slate-600/60 dark:bg-slate-900/70">
            <p className="mb-1 text-xs text-muted">{t("fields.client")}</p>
            <ClientSelector
              clients={clients}
              selectedClientId={settings.selected_client}
              disabled={actionLoading}
              onSelect={(clientId) => void selectClient(clientId)}
            />
          </div>

          <button
            type="button"
            aria-label={t("actions.openSettings")}
            className="no-drag rounded-xl border border-white/50 bg-white/70 p-2 dark:border-slate-600/60 dark:bg-slate-900/70"
            onClick={() => void openSettings()}
          >
            <Settings className="h-5 w-5" />
          </button>

          {showProfileSelector && (
            <div className="col-span-2 min-w-0 rounded-xl border border-white/45 bg-white/70 px-3 py-2 dark:border-slate-600/60 dark:bg-slate-900/70">
              <p className="mb-1 text-xs text-muted">{t("fields.profile")}</p>
              <ProfileSelector
                profiles={profiles}
                selectedProfileId={selectedProfileId}
                activeProfileName={status.active_profile_name}
                disabled={actionLoading || !canSelectItems}
                onSelect={(profileId) => void setActiveItem(profileId)}
              />
            </div>
          )}
        </header>

        <div className="mb-4 text-center">
          <StatusBadge status={status.status} />
        </div>

        <div title={canToggle ? undefined : selectedClient?.status_note}>
          <ConnectButton
            status={status.connection_state}
            disabled={actionLoading || !canToggle}
            onClick={() => void toggleConnection()}
          />
        </div>

        {selectedClient && !canToggle && (
          <p className="mt-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-center text-[11px] leading-4 text-muted">
            {selectedClient.status_note}
          </p>
        )}

        {showLowerBlock && (
          <div className="mt-4">
            {showInfoPanel && <InfoPanel status={status} settings={settings} />}

            {settings.show_action_buttons && (
              <div className={`no-drag mt-4 grid gap-2 text-xs ${settings.diagnostics_enabled ? "grid-cols-4" : "grid-cols-3"}`}>
                <button
                  className="group rounded-2xl border border-white/25 bg-white/5 px-2 py-2 transition hover:bg-white/10"
                  onClick={() => void refresh()}
                  disabled={actionLoading}
                >
                  <RefreshCcw className="mx-auto mb-1 h-4 w-4 text-cyan-200 transition group-hover:rotate-12" />
                  <span className="text-[12px] lowercase">{t("actions.refresh")}</span>
                </button>
                <button
                  className="group rounded-2xl border border-white/25 bg-white/5 px-2 py-2 transition hover:bg-white/10"
                  onClick={() => void openClient()}
                >
                  <SquareArrowOutUpRight className="mx-auto mb-1 h-4 w-4 text-indigo-200 transition group-hover:-translate-y-0.5" />
                  <span className="text-[12px] lowercase">{t("actions.openClient")}</span>
                </button>
                <button
                  className="group rounded-2xl border border-white/25 bg-white/5 px-2 py-2 transition hover:bg-white/10"
                  onClick={() => void copyIp()}
                >
                  <Copy className="mx-auto mb-1 h-4 w-4 text-emerald-200 transition group-hover:scale-105" />
                  <span className="text-[12px]">{t("actions.copyIp")}</span>
                </button>
                {settings.diagnostics_enabled && (
                  <button
                    className="group rounded-2xl border border-white/25 bg-white/5 px-2 py-2 transition hover:bg-white/10"
                    onClick={() => void openDiagnostics()}
                  >
                    <Globe className="mx-auto mb-1 h-4 w-4 text-amber-200 transition group-hover:scale-105" />
                    <span className="text-[12px] lowercase">{t("actions.diagnostics")}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {notice && (
          <div
            className={cn(
              "no-drag mt-3 rounded-xl border px-3 py-2 text-xs shadow-float",
              notice.kind === "error"
                ? "border-rose-300/60 bg-rose-500/15 text-rose-100"
                : "border-sky-300/60 bg-sky-500/15 text-sky-100"
            )}
          >
            <p>{notice.message}</p>
            {notice.action?.type === "relaunch_admin" && (
              <button
                type="button"
                className="mt-2 rounded-lg border border-white/40 bg-white/10 px-2 py-1 text-[11px]"
                onClick={() => void relaunchAsAdmin()}
              >
                {notice.action.label}
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
