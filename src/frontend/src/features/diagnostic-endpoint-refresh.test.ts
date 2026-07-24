import { describe, expect, it, vi } from "vitest";
import { createDiagnosticEndpointRefreshTracker } from "@/features/diagnostic-endpoint-refresh";
import type { AppSettings } from "@/lib/types";

const baseSettings: AppSettings = {
  selected_client: "v2rayn",
  language: "en",
  theme: "dark",
  always_on_top: true,
  autostart_with_windows: false,
  allow_restart_fallback: false,
  poll_interval_sec: 300,
  time_format: "system",
  show_clock: true,
  show_info_status: true,
  show_external_ip: true,
  show_latency: true,
  mock_mode_enabled: false,
  show_action_buttons: true,
  show_profile_selector: true,
  window_effect_enabled: true,
  window_opacity_percent: 100,
  diagnostics_enabled: false,
  diagnostics_url: "https://ipleak.net/",
  latency_mode: "active",
  connectivity_endpoints: ["https://example.com/health"],
  ip_endpoints: ["https://api.ipify.org"],
  v2rayn_path_mode: "auto",
  v2rayn_path: null,
  happ_path: null,
  happ_allow_ui_automation: false,
  window_position: null,
};

describe("diagnostic endpoint refresh tracking", () => {
  it("refreshes only after endpoint content changes", () => {
    const onEndpointsChanged = vi.fn();
    const track = createDiagnosticEndpointRefreshTracker(onEndpointsChanged);

    track(null);
    track(baseSettings);
    track({ ...baseSettings, theme: "light", poll_interval_sec: 10 });

    expect(onEndpointsChanged).not.toHaveBeenCalled();

    track({
      ...baseSettings,
      connectivity_endpoints: ["https://example.org/health"],
    });
    track({
      ...baseSettings,
      connectivity_endpoints: ["https://example.org/health"],
      ip_endpoints: ["https://ifconfig.me/ip"],
    });

    expect(onEndpointsChanged).toHaveBeenCalledTimes(2);
  });

  it("treats a settings reload after a null state as a new baseline", () => {
    const onEndpointsChanged = vi.fn();
    const track = createDiagnosticEndpointRefreshTracker(onEndpointsChanged);

    track(baseSettings);
    track(null);
    track({
      ...baseSettings,
      ip_endpoints: ["https://ifconfig.me/ip"],
    });

    expect(onEndpointsChanged).not.toHaveBeenCalled();
  });
});
