import type { AppSettings } from "@/lib/types";
import { useDashboardStore } from "@/features/dashboard-store";

export function diagnosticEndpointKey(settings: AppSettings | null): string | null {
  if (!settings) {
    return null;
  }

  return JSON.stringify([
    settings.connectivity_endpoints,
    settings.ip_endpoints,
  ]);
}

export function createDiagnosticEndpointRefreshTracker(
  onEndpointsChanged: () => void,
): (settings: AppSettings | null) => void {
  let previousKey: string | null = null;

  return (settings) => {
    const nextKey = diagnosticEndpointKey(settings);

    if (nextKey === null) {
      previousKey = null;
      return;
    }

    if (previousKey === null) {
      previousKey = nextKey;
      return;
    }

    if (nextKey === previousKey) {
      return;
    }

    previousKey = nextKey;
    onEndpointsChanged();
  };
}

export function installDiagnosticEndpointRefreshWatcher(): () => void {
  const track = createDiagnosticEndpointRefreshTracker(() => {
    queueMicrotask(() => {
      void useDashboardStore.getState().refresh();
    });
  });

  track(useDashboardStore.getState().settings);

  return useDashboardStore.subscribe((state) => {
    track(state.settings);
  });
}
