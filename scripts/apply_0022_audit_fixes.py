from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one match in {path}, found {count}: {old[:80]!r}")
    target.write_text(text.replace(old, new), encoding="utf-8")


replace(
    "src/tauri/src/main.rs",
    "    utils::{logger, settings_store, window_visuals},\n",
    "    utils::{logger, settings_store, window_position, window_visuals},\n",
)
replace(
    "src/tauri/src/main.rs",
    '''                    if label == "main" {
                        if let Some(bounds) = settings.window_position.clone() {
                            if let Err(error) = window
                                .set_position(tauri::PhysicalPosition::new(bounds.x, bounds.y))
                            {
                                warn!(?error, "failed to restore main window position");
                            }
                        }
                    }
''',
    '''                    if label == "main" {
                        if let Some(bounds) = settings.window_position.as_ref() {
                            match window_position::restore_or_center(&window, bounds) {
                                Ok(true) => {}
                                Ok(false) => warn!(
                                    x = bounds.x,
                                    y = bounds.y,
                                    "saved main window position is outside current monitors; centered window"
                                ),
                                Err(error) => warn!(%error, "failed to restore or center main window"),
                            }
                        }
                    }
''',
)
replace(
    "src/tauri/src/commands/mod.rs",
    '''fn merge_with_previous(mut next: DashboardStatus, previous: &DashboardStatus) -> DashboardStatus {
    if next.external_ip.is_none() {
        next.external_ip = previous.external_ip.clone();
    }

    if next.latency_ms.is_none() {
        next.latency_ms = previous.latency_ms;
    }

    if next.active_profile_name.is_none() {
        next.active_profile_name = previous.active_profile_name.clone();
    }

    next
}
''',
    '''fn merge_with_previous(mut next: DashboardStatus, previous: &DashboardStatus) -> DashboardStatus {
    if next.connection_state == ConnectionState::Disconnected {
        next.external_ip = None;
        next.latency_ms = None;
    } else {
        if next.external_ip.is_none() {
            next.external_ip = previous.external_ip.clone();
        }

        if next.latency_ms.is_none() {
            next.latency_ms = previous.latency_ms;
        }
    }

    if next.active_profile_name.is_none() {
        next.active_profile_name = previous.active_profile_name.clone();
    }

    next
}
''',
)
replace(
    "src/tauri/src/commands/mod.rs",
    '''    #[test]
    fn v2rayn_command_uses_selected_installation_as_working_directory() {
''',
    '''    #[test]
    fn disconnected_v2rayn_status_drops_stale_network_measurements() {
        let previous = DashboardStatus {
            external_ip: Some("1.1.1.1".to_owned()),
            latency_ms: Some(20),
            connection_state: ConnectionState::Connected,
            status: ConnectionState::Connected,
            ..DashboardStatus::default()
        };
        let next = DashboardStatus {
            connection_state: ConnectionState::Disconnected,
            status: ConnectionState::Disconnected,
            ..DashboardStatus::default()
        };

        let merged = merge_with_previous(next, &previous);

        assert!(merged.external_ip.is_none());
        assert!(merged.latency_ms.is_none());
    }

    #[test]
    fn partial_active_v2rayn_refresh_keeps_last_network_measurements() {
        let previous = DashboardStatus {
            external_ip: Some("1.1.1.1".to_owned()),
            latency_ms: Some(20),
            connection_state: ConnectionState::Connected,
            status: ConnectionState::Connected,
            ..DashboardStatus::default()
        };
        let next = DashboardStatus {
            connection_state: ConnectionState::Connecting,
            status: ConnectionState::Connecting,
            ..DashboardStatus::default()
        };

        let merged = merge_with_previous(next, &previous);

        assert_eq!(merged.external_ip.as_deref(), Some("1.1.1.1"));
        assert_eq!(merged.latency_ms, Some(20));
    }

    #[test]
    fn v2rayn_command_uses_selected_installation_as_working_directory() {
''',
)
replace(
    "src/frontend/src/app/SettingsWindow.tsx",
    'import { getCurrentWindow } from "@tauri-apps/api/window";\n',
    'import { getVersion } from "@tauri-apps/api/app";\nimport { getCurrentWindow } from "@tauri-apps/api/window";\n',
)
replace(
    "src/frontend/src/app/SettingsWindow.tsx",
    'const APP_VERSION = "1.0.0";\n',
    "",
)
replace(
    "src/frontend/src/app/SettingsWindow.tsx",
    '''  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [locales, setLocales] = useState<LocaleInfo[]>([]);
''',
    '''  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [locales, setLocales] = useState<LocaleInfo[]>([]);
  const [appVersion, setAppVersion] = useState<string | null>(null);
''',
)
replace(
    "src/frontend/src/app/SettingsWindow.tsx",
    '''        const [nextSettings, nextLocales] = await Promise.all([getSettings(), getAvailableLocales()]);
        if (!active) {
          return;
        }
        setSettings(nextSettings);
        setLocales(nextLocales);
''',
    '''        const [nextSettings, nextLocales, version] = await Promise.all([
          getSettings(),
          getAvailableLocales(),
          getVersion().catch(() => null)
        ]);
        if (!active) {
          return;
        }
        setSettings(nextSettings);
        setLocales(nextLocales);
        setAppVersion(version);
''',
)
replace(
    "src/frontend/src/app/SettingsWindow.tsx",
    '''              {t("settings.version")}: {APP_VERSION}
''',
    '''              {t("settings.version")}: {appVersion ?? "—"}
''',
)
replace(
    "src/frontend/src/app/SettingsWindow.test.tsx",
    '''const eventMocks = vi.hoisted(() => ({ listen: vi.fn() }));
const apiMocks = vi.hoisted(() => ({
''',
    '''const eventMocks = vi.hoisted(() => ({ listen: vi.fn() }));
const appMocks = vi.hoisted(() => ({ getVersion: vi.fn() }));
const apiMocks = vi.hoisted(() => ({
''',
)
replace(
    "src/frontend/src/app/SettingsWindow.test.tsx",
    '''vi.mock("@/lib/api", () => apiMocks);

vi.mock("@tauri-apps/api/event", () => eventMocks);
''',
    '''vi.mock("@/lib/api", () => apiMocks);

vi.mock("@tauri-apps/api/app", () => appMocks);
vi.mock("@tauri-apps/api/event", () => eventMocks);
''',
)
replace(
    "src/frontend/src/app/SettingsWindow.test.tsx",
    '''    eventMocks.listen.mockResolvedValue(() => undefined);
    apiMocks.getSettings.mockResolvedValue(baseSettings);
''',
    '''    eventMocks.listen.mockResolvedValue(() => undefined);
    appMocks.getVersion.mockResolvedValue("1.2.3");
    apiMocks.getSettings.mockResolvedValue(baseSettings);
''',
)
replace(
    "src/frontend/src/app/SettingsWindow.test.tsx",
    '''  it("saves draft-only application settings", async () => {
''',
    '''  it("shows the runtime application version instead of a hardcoded release", async () => {
    render(<SettingsWindow />);

    await screen.findByRole("heading", { name: "Settings" });

    expect(await screen.findByText(/Version:\\s*1\\.2\\.3/)).not.toBeNull();
    expect(appMocks.getVersion).toHaveBeenCalledTimes(1);
  });

  it("saves draft-only application settings", async () => {
''',
)

print("0022 exact audit replacements applied")
