import type { AppSettings } from "@/lib/types";

export function activeClientOperationalContextChanged(
  previous: AppSettings | null,
  next: AppSettings,
): boolean {
  if (!previous || previous.selected_client !== next.selected_client) {
    return true;
  }

  if (next.selected_client === "v2rayn") {
    return (
      previous.v2rayn_path_mode !== next.v2rayn_path_mode ||
      previous.v2rayn_path !== next.v2rayn_path ||
      previous.mock_mode_enabled !== next.mock_mode_enabled
    );
  }

  return (
    previous.happ_path !== next.happ_path ||
    previous.happ_allow_ui_automation !== next.happ_allow_ui_automation
  );
}

export function activeClientOperationalRefreshKey(
  settings: AppSettings | null,
): string | null {
  if (!settings) {
    return null;
  }

  const clientContext = settings.selected_client === "v2rayn"
    ? [
        settings.v2rayn_path_mode,
        settings.v2rayn_path,
        settings.mock_mode_enabled,
      ]
    : [settings.happ_path, settings.happ_allow_ui_automation];

  return JSON.stringify([
    settings.selected_client,
    ...clientContext,
    settings.show_external_ip,
    settings.show_latency,
    settings.latency_mode,
  ]);
}

export function settingsTransitionRequiresOperationalRefresh(
  previous: AppSettings | null,
  next: AppSettings,
): boolean {
  if (!previous) {
    return false;
  }

  // Main's explicit client-selection action owns the selected client's startup
  // refresh. Starting a second refresh from the optimistic settings transition
  // can race the backend select_client command and read the old adapter context.
  if (previous.selected_client !== next.selected_client) {
    return false;
  }

  return (
    activeClientOperationalRefreshKey(previous) !==
    activeClientOperationalRefreshKey(next)
  );
}
