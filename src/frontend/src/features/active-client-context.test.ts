import { describe, expect, it } from "vitest";
import {
  activeClientOperationalContextChanged,
  activeClientOperationalRefreshKey,
} from "@/features/active-client-context";
import type { AppSettings } from "@/lib/types";

const baseSettings: AppSettings = {
  selected_client: "v2rayn",
  language: "en",
  theme: "dark",
  always_on_top: false,
  autostart_with_windows: false,
  allow_restart_fallback: false,
  poll_interval_sec: 10,
  time_format: "24h",
  show_clock: true,
  show_info_status: true,
  show_external_ip: true,
  show_latency: true,
  mock_mode_enabled: false,
  show_action_buttons: true,
  show_profile_selector: true,
  window_effect_enabled: true,
  window_opacity_percent: 92,
  diagnostics_enabled: false,
  diagnostics_url: "https://ipleak.net/",
  latency_mode: "active",
  connectivity_endpoints: [],
  ip_endpoints: [],
  v2rayn_path_mode: "auto",
  v2rayn_path: null,
  happ_path: null,
  happ_allow_ui_automation: false,
  window_position: null,
};

describe("active client operational context", () => {
  it("ignores inactive Happ changes while v2rayN is selected", () => {
    const next = {
      ...baseSettings,
      happ_path: "C:\\Apps\\Happ\\Happ.exe",
      happ_allow_ui_automation: true,
    };

    expect(activeClientOperationalContextChanged(baseSettings, next)).toBe(false);
    expect(activeClientOperationalRefreshKey(next)).toBe(
      activeClientOperationalRefreshKey(baseSettings),
    );
  });

  it("ignores inactive v2rayN and mock changes while Happ is selected", () => {
    const previous = { ...baseSettings, selected_client: "happ" as const };
    const next = {
      ...previous,
      v2rayn_path_mode: "manual" as const,
      v2rayn_path: "C:\\Apps\\v2rayN",
      mock_mode_enabled: true,
    };

    expect(activeClientOperationalContextChanged(previous, next)).toBe(false);
    expect(activeClientOperationalRefreshKey(next)).toBe(
      activeClientOperationalRefreshKey(previous),
    );
  });

  it("invalidates active v2rayN path or mock changes", () => {
    expect(
      activeClientOperationalContextChanged(baseSettings, {
        ...baseSettings,
        v2rayn_path_mode: "manual",
        v2rayn_path: "C:\\Apps\\v2rayN",
      }),
    ).toBe(true);
    expect(
      activeClientOperationalContextChanged(baseSettings, {
        ...baseSettings,
        mock_mode_enabled: true,
      }),
    ).toBe(true);
  });

  it("invalidates active Happ path or consent changes", () => {
    const previous = { ...baseSettings, selected_client: "happ" as const };
    expect(
      activeClientOperationalContextChanged(previous, {
        ...previous,
        happ_path: "C:\\Apps\\Happ\\Happ.exe",
      }),
    ).toBe(true);
    expect(
      activeClientOperationalContextChanged(previous, {
        ...previous,
        happ_allow_ui_automation: true,
      }),
    ).toBe(true);
  });

  it("refreshes for shared health-display settings without changing client context", () => {
    const next = { ...baseSettings, show_latency: false };
    expect(activeClientOperationalContextChanged(baseSettings, next)).toBe(false);
    expect(activeClientOperationalRefreshKey(next)).not.toBe(
      activeClientOperationalRefreshKey(baseSettings),
    );
  });
});
