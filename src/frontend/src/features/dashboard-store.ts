import { create } from "zustand";
import {
  getClientCatalog,
  getSettings,
  getStatus,
  listSelectedClientItems,
  openDebugWindow,
  openDiagnosticsWindow,
  openSelectedClient,
  openSettingsWindow,
  refreshSelectedClient,
  refreshSelectedClientBackground,
  refreshSelectedClientPostRoute,
  refreshSelectedClientStartup,
  relaunchWidgetAsAdmin,
  selectClient as selectClientApi,
  selectClientItem as selectClientItemApi,
  toggleSelectedClient
} from "@/lib/api";
import i18n from "@/lib/i18n";
import type {
  AppSettings,
  ClientDescriptor,
  DashboardStatus,
  ProfileSummary,
  ProxyClientId,
  UiNotice
} from "@/lib/types";

interface DashboardState {
  status: DashboardStatus | null;
  settings: AppSettings | null;
  clients: ClientDescriptor[];
  profiles: ProfileSummary[];
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
  notice: UiNotice | null;
  pathNoticeKey: string | null;
  bootstrap: () => Promise<void>;
  refresh: (options?: { background?: boolean }) => Promise<void>;
  selectClient: (clientId: ProxyClientId) => Promise<void>;
  toggleConnection: () => Promise<void>;
  setActiveItem: (itemId: string) => Promise<void>;
  openClient: () => Promise<void>;
  openSettings: () => Promise<void>;
  openDebug: () => Promise<void>;
  openDiagnostics: () => Promise<void>;
  relaunchAsAdmin: () => Promise<void>;
  applyExternalSettings: (settings: AppSettings) => void;
  showNotice: (notice: Omit<UiNotice, "id">) => void;
  clearNotice: () => void;
}

let postRouteRefreshTimer: number | null = null;
let refreshInFlight = false;
let manualRefreshQueued = false;

function applyTheme(theme: "light" | "dark"): void {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function applyLanguage(language: string): void {
  void i18n.changeLanguage(language);
}

function applyVisualSettings(settings: AppSettings): void {
  const root = document.documentElement;
  const body = document.body;

  const opacity = Math.max(10, Math.min(100, Math.round(settings.window_opacity_percent)));
  root.style.setProperty("--widget-opacity", `${opacity / 100}`);
  body.classList.toggle("widget-effect-disabled", !settings.window_effect_enabled);
}

function pathNoticeFor(settings: AppSettings): string | null {
  if (settings.selected_client !== "v2rayn") {
    return null;
  }

  return settings.v2rayn_path_mode === "manual" && !settings.v2rayn_path
    ? "dashboard.pathConfigMissing"
    : null;
}

function defaultStatus(): DashboardStatus {
  return {
    status: "Unknown",
    tun_enabled: false,
    connection_state: "Unknown",
    active_profile_name: null,
    external_ip: null,
    latency_ms: null,
    last_error: null,
    last_event: null,
    updated_at: new Date().toISOString()
  };
}

function backendErrorText(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message.length > 0) {
      return message;
    }
  }

  return fallback;
}

function buildNoticeFromError(error: unknown, fallback: string): UiNotice {
  const raw = backendErrorText(error, fallback);

  if (raw.includes("UIPI_MISMATCH")) {
    return {
      id: Date.now(),
      kind: "error",
      message: i18n.t("errors.uipiMismatch"),
      action: {
        type: "relaunch_admin",
        label: i18n.t("actions.relaunchAdmin")
      }
    };
  }

  return {
    id: Date.now(),
    kind: "error",
    message: raw
  };
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  status: null,
  settings: null,
  clients: [],
  profiles: [],
  loading: true,
  actionLoading: false,
  error: null,
  notice: null,
  pathNoticeKey: null,

  bootstrap: async () => {
    set({ loading: true, error: null });

    try {
      const [settings, clients] = await Promise.all([getSettings(), getClientCatalog()]);
      applyTheme(settings.theme);
      applyLanguage(settings.language);
      applyVisualSettings(settings);

      const [status, profiles] = await Promise.all([
        refreshSelectedClientStartup().catch(() => getStatus().catch(() => defaultStatus())),
        listSelectedClientItems().catch(() => [])
      ]);

      set({
        settings,
        clients,
        status,
        profiles,
        pathNoticeKey: pathNoticeFor(settings),
        loading: false,
        error: null
      });
    } catch (error) {
      set({
        loading: false,
        status: defaultStatus(),
        settings: null,
        clients: [],
        profiles: [],
        pathNoticeKey: null,
        error: error instanceof Error ? error.message : "bootstrap_failed"
      });
    }
  },

  refresh: async (options) => {
    const background = options?.background === true;
    if (refreshInFlight) {
      if (!background) {
        manualRefreshQueued = true;
        set({ actionLoading: true, error: null });
      }
      return;
    }

    if (!background) {
      set({ actionLoading: true, error: null });
    }

    refreshInFlight = true;
    try {
      const status = background ? await refreshSelectedClientBackground() : await refreshSelectedClient();
      const profiles = await listSelectedClientItems().catch(() => []);

      set((prev) => ({
        status,
        profiles,
        actionLoading: background ? prev.actionLoading : false
      }));
    } catch (error) {
      if (!background) {
        set({
          actionLoading: false,
          error: error instanceof Error ? error.message : "refresh_failed",
          notice: buildNoticeFromError(error, i18n.t("errors.refreshFailed"))
        });
      }
    } finally {
      refreshInFlight = false;
      if (manualRefreshQueued) {
        manualRefreshQueued = false;
        void get().refresh({ background: false });
      }
    }
  },

  selectClient: async (clientId) => {
    const current = get().settings;
    if (!current || current.selected_client === clientId) {
      return;
    }

    set({ actionLoading: true, error: null, profiles: [], status: defaultStatus() });
    try {
      const settings = await selectClientApi(clientId);
      applyTheme(settings.theme);
      applyLanguage(settings.language);
      applyVisualSettings(settings);

      const [status, profiles] = await Promise.all([
        refreshSelectedClientStartup().catch(() => defaultStatus()),
        listSelectedClientItems().catch(() => [])
      ]);

      set({
        settings,
        status,
        profiles,
        actionLoading: false,
        pathNoticeKey: pathNoticeFor(settings)
      });
    } catch (error) {
      set({
        actionLoading: false,
        error: error instanceof Error ? error.message : "select_client_failed",
        notice: buildNoticeFromError(error, i18n.t("errors.clientSwitchFailed"))
      });
    }
  },

  toggleConnection: async () => {
    set({ actionLoading: true, error: null });
    try {
      const status = await toggleSelectedClient();
      set({ status, actionLoading: false });

      if (postRouteRefreshTimer !== null) {
        window.clearTimeout(postRouteRefreshTimer);
      }

      postRouteRefreshTimer = window.setTimeout(() => {
        void (async () => {
          try {
            const refreshedStatus = await refreshSelectedClientPostRoute();
            const profiles = await listSelectedClientItems().catch(() => []);
            set((prev) => ({
              status: refreshedStatus,
              profiles: profiles.length > 0 ? profiles : prev.profiles
            }));
          } catch {
            // Keep fast route-change UX even if delayed network refresh fails.
          } finally {
            postRouteRefreshTimer = null;
          }
        })();
      }, 3200);
    } catch (error) {
      set({
        actionLoading: false,
        error: error instanceof Error ? error.message : "toggle_failed",
        notice: buildNoticeFromError(error, i18n.t("errors.toggleFailed"))
      });
    }
  },

  setActiveItem: async (itemId) => {
    if (!itemId) {
      return;
    }

    set({ actionLoading: true, error: null });
    try {
      const status = await selectClientItemApi(itemId);
      const profiles = await listSelectedClientItems().catch(() => []);
      set({ status, profiles, actionLoading: false });

      if (postRouteRefreshTimer !== null) {
        window.clearTimeout(postRouteRefreshTimer);
      }

      postRouteRefreshTimer = window.setTimeout(() => {
        void (async () => {
          try {
            const refreshedStatus = await refreshSelectedClientPostRoute();
            const refreshedProfiles = await listSelectedClientItems().catch(() => []);
            set((prev) => ({
              status: refreshedStatus,
              profiles: refreshedProfiles.length > 0 ? refreshedProfiles : prev.profiles
            }));
          } catch {
            // Keep fast item-switch UX even if delayed network refresh fails.
          } finally {
            postRouteRefreshTimer = null;
          }
        })();
      }, 5000);
    } catch (error) {
      set({
        actionLoading: false,
        error: error instanceof Error ? error.message : "set_item_failed",
        notice: buildNoticeFromError(error, i18n.t("errors.profileSwitchFailed"))
      });
    }
  },

  openClient: async () => {
    try {
      await openSelectedClient();
    } catch (error) {
      set({
        notice: buildNoticeFromError(error, i18n.t("errors.openFailed"))
      });
    }
  },

  openSettings: async () => {
    await openSettingsWindow();
  },

  openDebug: async () => {
    await openDebugWindow();
  },

  openDiagnostics: async () => {
    try {
      await openDiagnosticsWindow();
    } catch (error) {
      set({
        notice: buildNoticeFromError(error, i18n.t("errors.diagnosticsOpenFailed"))
      });
    }
  },

  relaunchAsAdmin: async () => {
    await relaunchWidgetAsAdmin();
  },

  applyExternalSettings: (settings) => {
    applyTheme(settings.theme);
    applyLanguage(settings.language);
    applyVisualSettings(settings);
    set({ settings, pathNoticeKey: pathNoticeFor(settings) });
  },

  showNotice: (notice) =>
    set({
      notice: {
        ...notice,
        id: Date.now()
      }
    }),

  clearNotice: () => set({ notice: null })
}));
