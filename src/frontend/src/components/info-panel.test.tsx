import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InfoPanel } from "@/components/info-panel";
import type { AppSettings, DashboardStatus } from "@/lib/types";
import "@/lib/i18n";

const baseStatus: DashboardStatus = {
  status: "Connected",
  tun_enabled: true,
  connection_state: "Connected",
  active_profile_name: "demo",
  external_ip: null,
  latency_ms: 42,
  last_error: null,
  last_event: null,
  updated_at: "now"
};

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
  window_position: null
};

describe("InfoPanel", () => {
  it("renders configured network fields", () => {
    render(<InfoPanel status={baseStatus} settings={baseSettings} />);

    expect(screen.getByText("External IP")).toBeTruthy();
    expect(screen.getByText("Latency")).toBeTruthy();
    expect(screen.getByText("42 ms")).toBeTruthy();
  });

  it("hides optional fields when disabled", () => {
    render(
      <InfoPanel
        status={baseStatus}
        settings={{
          ...baseSettings,
          show_info_status: false,
          show_clock: false,
          show_external_ip: false,
          show_latency: false
        }}
      />
    );

    expect(screen.queryByText("External IP")).toBeNull();
    expect(screen.queryByText("Latency")).toBeNull();
  });
});
