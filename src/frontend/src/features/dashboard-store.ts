import { create } from "zustand";
import {
  getSettings,
  getStatus,
  listProfiles,
  openDebugWindow,
  openSettingsWindow,
  openV2RayN,
  refreshStatus,
  refreshStatusBackground,
  refreshStatusPostRoute,
  refreshStatusStartup,
  relaunchWidgetAsAdmin,
  setActiveProfile as setActiveProfileApi,
  toggleTunViaUi
} from "@/lib/api";
import i18n from "@/lib/i18n";
import type { AppSettings, DashboardStatus, ProfileSummary, UiNotice } from "@/lib/types";

interface DashboardState {
  status: DashboardStatus | null;
  settings: AppSettings | null;
  profiles: ProfileSummary[];
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
  notice: UiNotice | null;
  pathNoticeKey: string | null;
  bootstrap: () => Promise<void>;
  refresh: (options?: { background?: boolean }) => Promise<void>;
  toggleTun: () => Promise<void>;
  setActiveProfile: (profileId: string) => Promise<void>;
  openV2RayN: () => Promise<void>;
  openSettings: () => Promise<void>;
  openDebug: () => Promise<void>;
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
  profiles: [],
  loading: true,
  actionLoading: false,
  error: null,
  notice: null,
  pathNoticeKey: null,

  bootstrap: async () => {
    set({ loading: true, error: null });

    try {
      const settings = await getSettings();
      applyTheme(settings.theme);
      applyLanguage(settings.language);
      applyVisualSettings(settings);

      const [status, profiles] = await Promise.all([
        refreshStatusStartup().catch(() => getStatus().catch(() => defaultStatus())),
        listProfiles().catch(() => [])
      ]);

      set({
        settings,
        status,
        profiles,
        pathNoticeKey:
          settings.v2rayn_path_mode === "manual" && !settings.v2rayn_path ? "dashboard.pathConfigMissing" : null,
        loading: false,
        error: null
      });
    } catch (error) {
      set({
        loading: false,
        status: defaultStatus(),
        settings: null,
        profiles: [],
        pathNoticeKey: "dashboard.pathConfigMissing",
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
      const status = background ? await refreshStatusBackground() : await refreshStatus();
      const profiles = await listProfiles().catch(() => []);

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

  toggleTun: async () => {
    set({ actionLoading: true, error: null });
    try {
      const status = await toggleTunViaUi();
      set({ status, actionLoading: false });

      if (postRouteRefreshTimer !== null) {
        window.clearTimeout(postRouteRefreshTimer);
      }

      postRouteRefreshTimer = window.setTimeout(() => {
        void (async () => {
          try {
            const refreshedStatus = await refreshStatusPostRoute();
            const profiles = await listProfiles().catch(() => []);
            set((prev) => ({
              status: refreshedStatus,
              profiles: profiles.length > 0 ? profiles : prev.profiles
            }));
          } catch {
            // keep fast route-change UX even if delayed network refresh fails
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

  setActiveProfile: async (profileId) => {
    if (!profileId) {
      return;
    }

    set({ actionLoading: true, error: null });
    try {
      const status = await setActiveProfileApi(profileId);
      const profiles = await listProfiles().catch(() => []);
      set({ status, profiles, actionLoading: false });

      if (postRouteRefreshTimer !== null) {
        window.clearTimeout(postRouteRefreshTimer);
      }

      postRouteRefreshTimer = window.setTimeout(() => {
        void (async () => {
          try {
            const refreshedStatus = await refreshStatusPostRoute();
            const refreshedProfiles = await listProfiles().catch(() => []);
            set((prev) => ({
              status: refreshedStatus,
              profiles: refreshedProfiles.length > 0 ? refreshedProfiles : prev.profiles
            }));
          } catch {
            // keep fast profile-switch UX even if delayed network refresh fails
          } finally {
            postRouteRefreshTimer = null;
          }
        })();
      }, 5000);
    } catch (error) {
      set({
        actionLoading: false,
        error: error instanceof Error ? error.message : "set_profile_failed",
        notice: buildNoticeFromError(error, i18n.t("errors.profileSwitchFailed"))
      });
    }
  },

  openV2RayN: async () => {
    try {
      await openV2RayN();
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

  relaunchAsAdmin: async () => {
    await relaunchWidgetAsAdmin();
  },

  applyExternalSettings: (settings) => {
    applyTheme(settings.theme);
    applyLanguage(settings.language);
    applyVisualSettings(settings);
    set({ settings });
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

