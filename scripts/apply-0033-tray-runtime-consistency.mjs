import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}
function write(path, content) {
  fs.writeFileSync(path, content.replaceAll("\r\n", "\n"), "utf8");
}
function replaceExact(path, before, after) {
  const source = read(path);
  const matches = source.split(before).length - 1;
  if (matches !== 1) throw new Error(`Expected exactly one match in ${path}, found ${matches}`);
  write(path, source.replace(before, after));
}

write(
  "src/tauri/src/models/tray.rs",
  `use serde::Serialize;\n\nuse crate::models::{client::ProxyClientId, status::DashboardStatus};\n\n#[derive(Debug, Clone, Copy, Serialize)]\n#[serde(rename_all = "snake_case")]\npub enum TrayOperation {\n    Refresh,\n    OpenClient,\n}\n\n#[derive(Debug, Clone, Serialize)]\npub struct TrayOperationError {\n    pub operation: TrayOperation,\n    pub message: String,\n}\n\n#[derive(Debug, Clone, Serialize)]\npub struct TrayStatusUpdate {\n    pub client_id: ProxyClientId,\n    pub status: DashboardStatus,\n}\n`,
);

replaceExact(
  "src/tauri/src/models/mod.rs",
  "pub mod status;\n",
  "pub mod status;\npub mod tray;\n",
);

write(
  "src/tauri/src/utils/tray_menu.rs",
  `use tauri::{\n    menu::MenuItem,\n    tray::TrayIcon,\n    AppHandle, Manager, Wry,\n};\n\n#[derive(Debug, Clone, Copy, PartialEq, Eq)]\npub struct TrayLabels {\n    pub show: &'static str,\n    pub settings: &'static str,\n    pub refresh: &'static str,\n    pub open_client: &'static str,\n    pub exit: &'static str,\n    pub tooltip: &'static str,\n}\n\npub fn labels(language: &str) -> TrayLabels {\n    if language.trim().to_lowercase().starts_with("ru") {\n        TrayLabels {\n            show: "Показать виджет",\n            settings: "Настройки",\n            refresh: "Обновить статус",\n            open_client: "Открыть выбранный клиент",\n            exit: "Выход",\n            tooltip: "Виджет прокси-клиента",\n        }\n    } else {\n        TrayLabels {\n            show: "Show Widget",\n            settings: "Settings",\n            refresh: "Refresh Status",\n            open_client: "Open Selected Client",\n            exit: "Exit",\n            tooltip: "Proxy Client Widget",\n        }\n    }\n}\n\npub struct TrayMenuState {\n    tray: TrayIcon<Wry>,\n    show_item: MenuItem<Wry>,\n    settings_item: MenuItem<Wry>,\n    refresh_item: MenuItem<Wry>,\n    open_item: MenuItem<Wry>,\n    exit_item: MenuItem<Wry>,\n}\n\nimpl TrayMenuState {\n    pub fn new(\n        tray: TrayIcon<Wry>,\n        show_item: MenuItem<Wry>,\n        settings_item: MenuItem<Wry>,\n        refresh_item: MenuItem<Wry>,\n        open_item: MenuItem<Wry>,\n        exit_item: MenuItem<Wry>,\n    ) -> Self {\n        Self {\n            tray,\n            show_item,\n            settings_item,\n            refresh_item,\n            open_item,\n            exit_item,\n        }\n    }\n\n    pub fn apply_language(&self, language: &str) -> Result<(), String> {\n        let labels = labels(language);\n        self.show_item\n            .set_text(labels.show)\n            .map_err(|error| format!("Could not update tray Show label: {error}"))?;\n        self.settings_item\n            .set_text(labels.settings)\n            .map_err(|error| format!("Could not update tray Settings label: {error}"))?;\n        self.refresh_item\n            .set_text(labels.refresh)\n            .map_err(|error| format!("Could not update tray Refresh label: {error}"))?;\n        self.open_item\n            .set_text(labels.open_client)\n            .map_err(|error| format!("Could not update tray Open Client label: {error}"))?;\n        self.exit_item\n            .set_text(labels.exit)\n            .map_err(|error| format!("Could not update tray Exit label: {error}"))?;\n        self.tray\n            .set_tooltip(Some(labels.tooltip))\n            .map_err(|error| format!("Could not update tray tooltip: {error}"))?;\n        Ok(())\n    }\n}\n\npub fn apply_language(app: &AppHandle, language: &str) -> Result<(), String> {\n    app.state::<TrayMenuState>().apply_language(language)\n}\n\n#[cfg(test)]\nmod tests {\n    use super::*;\n\n    #[test]\n    fn russian_language_uses_localized_tray_labels() {\n        let labels = labels("ru-RU");\n        assert_eq!(labels.show, "Показать виджет");\n        assert_eq!(labels.refresh, "Обновить статус");\n        assert_eq!(labels.tooltip, "Виджет прокси-клиента");\n    }\n\n    #[test]\n    fn unknown_language_falls_back_to_english_labels() {\n        let labels = labels("de");\n        assert_eq!(labels.show, "Show Widget");\n        assert_eq!(labels.open_client, "Open Selected Client");\n        assert_eq!(labels.tooltip, "Proxy Client Widget");\n    }\n}\n`,
);

replaceExact(
  "src/tauri/src/utils/mod.rs",
  "pub mod settings_store;\n",
  "pub mod settings_store;\npub mod tray_menu;\n",
);

replaceExact(
  "src/tauri/src/main.rs",
  "    models::{settings::WindowPosition, status::DashboardStatus},\n",
  `    models::{\n        settings::WindowPosition,\n        status::DashboardStatus,\n        tray::{TrayOperation, TrayOperationError, TrayStatusUpdate},\n    },\n`,
);

replaceExact(
  "src/tauri/src/main.rs",
  "    utils::{logger, settings_store, window_position, window_visuals},\n",
  "    utils::{logger, settings_store, tray_menu, window_position, window_visuals},\n",
);

replaceExact(
  "src/tauri/src/main.rs",
  "fn main() {\n",
  `fn emit_tray_operation_error(\n    app: &tauri::AppHandle,\n    operation: TrayOperation,\n    message: String,\n) {\n    let payload = TrayOperationError { operation, message };\n    if let Err(error) = app.emit("tray-operation-error", payload) {\n        warn!(?error, "failed to emit tray-operation-error event");\n    }\n}\n\nfn main() {\n`,
);

replaceExact(
  "src/tauri/src/main.rs",
  `        .setup(move |app| {\n            let show_item = MenuItemBuilder::with_id("show", "Show Widget").build(app)?;\n            let settings_item = MenuItemBuilder::with_id("settings", "Settings").build(app)?;\n            let refresh_item = MenuItemBuilder::with_id("refresh", "Refresh Status").build(app)?;\n            let open_item =\n                MenuItemBuilder::with_id("open_client", "Open Selected Client").build(app)?;\n            let exit_item = MenuItemBuilder::with_id("exit", "Exit").build(app)?;\n`,
  `        .setup(move |app| {\n            let tray_labels = tray_menu::labels(&settings.language);\n            let show_item = MenuItemBuilder::with_id("show", tray_labels.show).build(app)?;\n            let settings_item =\n                MenuItemBuilder::with_id("settings", tray_labels.settings).build(app)?;\n            let refresh_item =\n                MenuItemBuilder::with_id("refresh", tray_labels.refresh).build(app)?;\n            let open_item =\n                MenuItemBuilder::with_id("open_client", tray_labels.open_client).build(app)?;\n            let exit_item = MenuItemBuilder::with_id("exit", tray_labels.exit).build(app)?;\n`,
);

replaceExact(
  "src/tauri/src/main.rs",
  `            let mut tray_builder = TrayIconBuilder::new()\n                .tooltip("Proxy Client Widget")\n                .menu(&menu);\n`,
  `            let mut tray_builder = TrayIconBuilder::new()\n                .tooltip(tray_labels.tooltip)\n                .menu(&menu);\n`,
);

replaceExact(
  "src/tauri/src/main.rs",
  `                    "refresh" => {\n                        let app_handle = app.clone();\n                        tauri::async_runtime::spawn(async move {\n                            let state = app_handle.state::<AppState>();\n                            if let Ok(status) =\n                                client_commands::refresh_selected_client(state).await\n                            {\n                                info!(?status.connection_state, "refresh from tray succeeded");\n                            }\n                        });\n                    }\n`,
  `                    "refresh" => {\n                        let app_handle = app.clone();\n                        tauri::async_runtime::spawn(async move {\n                            let state = app_handle.state::<AppState>();\n                            let client_id = state.snapshot().settings.selected_client;\n                            match client_commands::refresh_selected_client(state).await {\n                                Ok(status) => {\n                                    info!(?status.connection_state, "refresh from tray succeeded");\n                                    let payload = TrayStatusUpdate { client_id, status };\n                                    if let Err(error) =\n                                        app_handle.emit("tray-status-updated", payload)\n                                    {\n                                        warn!(?error, "failed to emit tray-status-updated event");\n                                    }\n                                }\n                                Err(error) => {\n                                    error!(?error, "refresh from tray failed");\n                                    emit_tray_operation_error(\n                                        &app_handle,\n                                        TrayOperation::Refresh,\n                                        error,\n                                    );\n                                }\n                            }\n                        });\n                    }\n`,
);

replaceExact(
  "src/tauri/src/main.rs",
  `                            if let Err(error) = client_commands::open_selected_client(state).await {\n                                error!(?error, "open selected client from tray failed");\n                            }\n`,
  `                            if let Err(error) = client_commands::open_selected_client(state).await {\n                                error!(?error, "open selected client from tray failed");\n                                emit_tray_operation_error(\n                                    &app_handle,\n                                    TrayOperation::OpenClient,\n                                    error,\n                                );\n                            }\n`,
);

replaceExact(
  "src/tauri/src/main.rs",
  "            app.manage(tray);\n",
  `            app.manage(tray_menu::TrayMenuState::new(\n                tray,\n                show_item,\n                settings_item,\n                refresh_item,\n                open_item,\n                exit_item,\n            ));\n`,
);

replaceExact(
  "src/tauri/src/commands/mod.rs",
  "        settings_store, window_position,\n",
  "        settings_store, tray_menu, window_position,\n",
);

replaceExact(
  "src/tauri/src/commands/mod.rs",
  `    let always_on_top_changed = previous.always_on_top != next.always_on_top;\n    let autostart_changed = previous.autostart_with_windows != next.autostart_with_windows;\n`,
  `    let always_on_top_changed = previous.always_on_top != next.always_on_top;\n    let autostart_changed = previous.autostart_with_windows != next.autostart_with_windows;\n    let language_changed = previous.language != next.language;\n`,
);

replaceExact(
  "src/tauri/src/commands/mod.rs",
  `    if autostart_changed {\n        if let Err(error) = autostart::apply_autostart(next.autostart_with_windows) {\n            if always_on_top_changed {\n                let _ = set_all_windows_always_on_top(app, previous.always_on_top);\n            }\n            return Err(error.to_string());\n        }\n    }\n\n    Ok(())\n`,
  `    if autostart_changed {\n        if let Err(error) = autostart::apply_autostart(next.autostart_with_windows) {\n            if always_on_top_changed {\n                let _ = set_all_windows_always_on_top(app, previous.always_on_top);\n            }\n            return Err(error.to_string());\n        }\n    }\n\n    if language_changed {\n        if let Err(error) = tray_menu::apply_language(app, &next.language) {\n            let _ = tray_menu::apply_language(app, &previous.language);\n            if autostart_changed {\n                let _ = autostart::apply_autostart(previous.autostart_with_windows);\n            }\n            if always_on_top_changed {\n                let _ = set_all_windows_always_on_top(app, previous.always_on_top);\n            }\n            return Err(error);\n        }\n    }\n\n    Ok(())\n`,
);

replaceExact(
  "src/tauri/src/commands/mod.rs",
  `    if applied.autostart_with_windows != previous.autostart_with_windows {\n        if let Err(error) = autostart::apply_autostart(previous.autostart_with_windows) {\n            warn!(\n                ?error,\n                "failed to roll back autostart after settings persistence failure"\n            );\n        }\n    }\n}\n`,
  `    if applied.autostart_with_windows != previous.autostart_with_windows {\n        if let Err(error) = autostart::apply_autostart(previous.autostart_with_windows) {\n            warn!(\n                ?error,\n                "failed to roll back autostart after settings persistence failure"\n            );\n        }\n    }\n\n    if applied.language != previous.language {\n        if let Err(error) = tray_menu::apply_language(app, &previous.language) {\n            warn!(\n                ?error,\n                "failed to roll back tray language after settings persistence failure"\n            );\n        }\n    }\n}\n`,
);

replaceExact(
  "src/frontend/src/lib/types.ts",
  `export interface UiNotice {\n  id: number;\n  kind: "error" | "info";\n  message: string;\n  action?: UiNoticeAction;\n}\n`,
  `export interface UiNotice {\n  id: number;\n  kind: "error" | "info";\n  message: string;\n  action?: UiNoticeAction;\n}\n\nexport interface TrayStatusUpdate {\n  client_id: ProxyClientId;\n  status: DashboardStatus;\n}\n\nexport interface TrayOperationError {\n  operation: "refresh" | "open_client";\n  message: string;\n}\n`,
);

replaceExact(
  "src/frontend/src/features/dashboard-store.ts",
  `  ProxyClientId,\n  UiNotice,\n} from "@/lib/types";\n`,
  `  ProxyClientId,\n  TrayOperationError,\n  TrayStatusUpdate,\n  UiNotice,\n} from "@/lib/types";\n`,
);

replaceExact(
  "src/frontend/src/features/dashboard-store.ts",
  `  applyExternalSettings: (settings: AppSettings) => void;\n  showNotice: (notice: Omit<UiNotice, "id">) => void;\n`,
  `  applyExternalSettings: (settings: AppSettings) => void;\n  applyExternalStatus: (payload: TrayStatusUpdate) => void;\n  applyExternalOperationError: (payload: TrayOperationError) => void;\n  showNotice: (notice: Omit<UiNotice, "id">) => void;\n`,
);

replaceExact(
  "src/frontend/src/features/dashboard-store.ts",
  `function pathNoticeFor(settings: AppSettings): string | null {\n`,
  `function statusIsAtLeastAsFresh(\n  candidate: DashboardStatus,\n  current: DashboardStatus | null,\n): boolean {\n  if (!current) {\n    return true;\n  }\n\n  const candidateTime = Date.parse(candidate.updated_at);\n  const currentTime = Date.parse(current.updated_at);\n  if (!Number.isFinite(candidateTime) || !Number.isFinite(currentTime)) {\n    return true;\n  }\n\n  return candidateTime >= currentTime;\n}\n\nfunction pathNoticeFor(settings: AppSettings): string | null {\n`,
);

replaceExact(
  "src/frontend/src/features/dashboard-store.ts",
  `      set({\n        settings,\n        clients,\n        status,\n        profiles,\n        pathNoticeKey: pathNoticeFor(settings),\n        loading: false,\n        error: null,\n      });\n`,
  `      set((previous) => ({\n        settings,\n        clients,\n        status: statusIsAtLeastAsFresh(status, previous.status)\n          ? status\n          : previous.status,\n        profiles,\n        pathNoticeKey: pathNoticeFor(settings),\n        loading: false,\n        error: null,\n      }));\n`,
);

replaceExact(
  "src/frontend/src/features/dashboard-store.ts",
  `      set((prev) => ({\n        status,\n        profiles,\n        actionLoading: background ? prev.actionLoading : false,\n      }));\n`,
  `      set((prev) => {\n        const accept = statusIsAtLeastAsFresh(status, prev.status);\n        return {\n          status: accept ? status : prev.status,\n          profiles: accept ? profiles : prev.profiles,\n          actionLoading: background ? prev.actionLoading : false,\n        };\n      });\n`,
);

replaceExact(
  "src/frontend/src/features/dashboard-store.ts",
  `      set({\n        settings: resolvedSettings,\n        clients:\n          catalogRequest === catalogRequestRevision ? clients : get().clients,\n        status,\n        profiles,\n        actionLoading: false,\n        pathNoticeKey: pathNoticeFor(resolvedSettings),\n      });\n`,
  `      set((previous) => {\n        const accept = statusIsAtLeastAsFresh(status, previous.status);\n        return {\n          settings: resolvedSettings,\n          clients:\n            catalogRequest === catalogRequestRevision ? clients : get().clients,\n          status: accept ? status : previous.status,\n          profiles: accept ? profiles : previous.profiles,\n          actionLoading: false,\n          pathNoticeKey: pathNoticeFor(resolvedSettings),\n        };\n      });\n`,
);

replaceExact(
  "src/frontend/src/features/dashboard-store.ts",
  "      set({ status, actionLoading: false });\n",
  `      set((previous) => ({\n        status: statusIsAtLeastAsFresh(status, previous.status)\n          ? status\n          : previous.status,\n        actionLoading: false,\n      }));\n`,
);

replaceExact(
  "src/frontend/src/features/dashboard-store.ts",
  `            set((prev) => ({\n              status: refreshedStatus,\n              profiles: profiles.length > 0 ? profiles : prev.profiles,\n            }));\n`,
  `            set((prev) => {\n              const accept = statusIsAtLeastAsFresh(refreshedStatus, prev.status);\n              return {\n                status: accept ? refreshedStatus : prev.status,\n                profiles:\n                  accept && profiles.length > 0 ? profiles : prev.profiles,\n              };\n            });\n`,
);

replaceExact(
  "src/frontend/src/features/dashboard-store.ts",
  "      set({ status, profiles, actionLoading: false });\n",
  `      set((previous) => {\n        const accept = statusIsAtLeastAsFresh(status, previous.status);\n        return {\n          status: accept ? status : previous.status,\n          profiles: accept ? profiles : previous.profiles,\n          actionLoading: false,\n        };\n      });\n`,
);

replaceExact(
  "src/frontend/src/features/dashboard-store.ts",
  `            set((prev) => ({\n              status: refreshedStatus,\n              profiles:\n                refreshedProfiles.length > 0\n                  ? refreshedProfiles\n                  : prev.profiles,\n            }));\n`,
  `            set((prev) => {\n              const accept = statusIsAtLeastAsFresh(refreshedStatus, prev.status);\n              return {\n                status: accept ? refreshedStatus : prev.status,\n                profiles:\n                  accept && refreshedProfiles.length > 0\n                    ? refreshedProfiles\n                    : prev.profiles,\n              };\n            });\n`,
);

replaceExact(
  "src/frontend/src/features/dashboard-store.ts",
  `  applyExternalSettings: (settings) => {\n`,
  `  applyExternalStatus: (payload) => {\n    if (get().settings?.selected_client !== payload.client_id) {\n      return;\n    }\n\n    set((previous) =>\n      statusIsAtLeastAsFresh(payload.status, previous.status)\n        ? { status: payload.status }\n        : {},\n    );\n  },\n\n  applyExternalOperationError: (payload) => {\n    const fallback = payload.operation === "refresh"\n      ? i18n.t("errors.refreshFailed")\n      : i18n.t("errors.openFailed");\n    set({\n      notice: buildNoticeFromError(new Error(payload.message), fallback),\n    });\n  },\n\n  applyExternalSettings: (settings) => {\n`,
);

replaceExact(
  "src/frontend/src/app/App.tsx",
  `import type { AppSettings, CapabilityState } from "@/lib/types";\n`,
  `import type {\n  AppSettings,\n  CapabilityState,\n  TrayOperationError,\n  TrayStatusUpdate,\n} from "@/lib/types";\n`,
);

replaceExact(
  "src/frontend/src/app/App.tsx",
  `    clearNotice,\n    applyExternalSettings\n`,
  `    clearNotice,\n    applyExternalSettings,\n    applyExternalStatus,\n    applyExternalOperationError\n`,
);

replaceExact(
  "src/frontend/src/app/App.tsx",
  `  useEffect(\n    () =>\n      bindTauriListener<AppSettings>("settings-updated", (event) => {\n        applyExternalSettings(event.payload);\n      }),\n    [applyExternalSettings],\n  );\n`,
  `  useEffect(\n    () =>\n      bindTauriListener<AppSettings>("settings-updated", (event) => {\n        applyExternalSettings(event.payload);\n      }),\n    [applyExternalSettings],\n  );\n\n  useEffect(\n    () =>\n      bindTauriListener<TrayStatusUpdate>("tray-status-updated", (event) => {\n        applyExternalStatus(event.payload);\n      }),\n    [applyExternalStatus],\n  );\n\n  useEffect(\n    () =>\n      bindTauriListener<TrayOperationError>("tray-operation-error", (event) => {\n        applyExternalOperationError(event.payload);\n      }),\n    [applyExternalOperationError],\n  );\n`,
);

replaceExact(
  "src/frontend/src/features/dashboard-store-active-context.test.ts",
  `  it("rolls back only the selected client after a failed switch", async () => {\n`,
  `  it("keeps a newer tray status over an older in-flight frontend refresh", async () => {\n    const request = deferred<DashboardStatus>();\n    apiMocks.refreshSelectedClient.mockReturnValueOnce(request.promise);\n\n    const refresh = useDashboardStore.getState().refresh();\n    useDashboardStore.getState().applyExternalStatus({\n      client_id: "v2rayn",\n      status: connectedStatus("2026-07-31T00:00:02.000Z"),\n    });\n\n    request.resolve(connectedStatus("2026-07-31T00:00:01.000Z"));\n    await refresh;\n\n    expect(useDashboardStore.getState().status?.updated_at).toBe(\n      "2026-07-31T00:00:02.000Z",\n    );\n    expect(useDashboardStore.getState().actionLoading).toBe(false);\n  });\n\n  it("ignores tray status for an inactive client and surfaces tray errors", () => {\n    useDashboardStore.getState().applyExternalStatus({\n      client_id: "happ",\n      status: connectedStatus("2026-07-31T00:00:03.000Z"),\n    });\n    expect(useDashboardStore.getState().status?.updated_at).toBe("initial");\n\n    useDashboardStore.getState().applyExternalOperationError({\n      operation: "open_client",\n      message: "open failed from tray",\n    });\n    expect(useDashboardStore.getState().notice?.message).toBe(\n      "open failed from tray",\n    );\n  });\n\n  it("rolls back only the selected client after a failed switch", async () => {\n`,
);

replaceExact(
  "src/tauri/tests/product_surface_contracts.rs",
  `#[test]\nfn happ_toggle_confirms_before_restoring_the_original_minimized_state() {\n`,
  `#[test]\nfn tray_runtime_is_localized_and_reports_native_operation_results() {\n    let main = include_str!("../src/main.rs");\n    assert!(main.contains("tray_menu::labels(&settings.language)"));\n    assert!(main.contains("app_handle.emit(\"tray-status-updated\", payload)"));\n    assert!(main.contains("emit_tray_operation_error("));\n\n    let commands = include_str!("../src/commands/mod.rs");\n    assert!(commands.contains("tray_menu::apply_language(app, &next.language)"));\n    assert!(commands.contains("tray_menu::apply_language(app, &previous.language)"));\n\n    let app = include_str!("../../frontend/src/app/App.tsx");\n    assert!(app.contains("bindTauriListener<TrayStatusUpdate>(\"tray-status-updated\""));\n    assert!(app.contains("bindTauriListener<TrayOperationError>(\"tray-operation-error\""));\n}\n\n#[test]\nfn happ_toggle_confirms_before_restoring_the_original_minimized_state() {\n`,
);

replaceExact(
  "docs/architecture.md",
  `## Window lifecycle and geometry\n`,
  `## Native tray runtime\n\nThe tray menu is initialized from the persisted application language and retains live menu-item/tray handles so a successful language patch updates every label and tooltip immediately. Runtime language changes participate in the same apply/persist/rollback transaction as always-on-top and autostart.\n\nTray Refresh executes the selected adapter's backend refresh and emits a typed client-scoped status event to Main. Main ignores inactive-client events and compares backend timestamps so an older in-flight frontend response cannot overwrite a newer tray result. Refresh and Open Client failures emit typed operation errors and use the same visible notice/UIPI handling as equivalent Main actions.\n\n## Window lifecycle and geometry\n`,
);

write(
  "project-tracking/tasks/0033-tray-runtime-consistency.md",
  `# 0033 - Tray Runtime Consistency\n\n## Status\n\nImplementation in progress on \`audit/0033-tray-runtime-consistency\`.\n\n## Audited baseline\n\n\`main\` commit \`cd467b087cdcea13adda28dec4ff290cc23615d7\`.\n\n## Confirmed findings\n\n1. Tray labels and tooltip were hardcoded in English even when the persisted application language was Russian, and live language changes never updated the native menu.\n2. Tray Refresh committed backend state but did not deliver the returned status to an already open Main webview, leaving it stale until another poll.\n3. Tray Refresh and Open Selected Client failures were written only to logs and were invisible to the user.\n4. A direct tray status event needed client scoping and freshness ordering so it could not overwrite another selected client or be overwritten by an older in-flight frontend result.\n\n## Objective\n\nMake the native tray a first-class localized product surface with immediate, ordered Main synchronization and visible operation errors.\n\n## Acceptance criteria\n\n- [x] Tray starts with labels and tooltip matching persisted language.\n- [x] Successful live language changes update every tray label and tooltip.\n- [x] Tray language changes roll back when runtime application or settings persistence fails.\n- [x] Tray Refresh emits its exact returned status with selected-client identity.\n- [x] Main ignores inactive-client tray status and preserves the freshest backend timestamp.\n- [x] Older in-flight frontend refresh results cannot overwrite a newer tray result.\n- [x] Tray Refresh and Open Client errors become visible Main notices.\n- [x] Pure label tests, frontend ordering tests and product-surface contracts cover the behavior.\n- [ ] Exact-head frontend and Rust Release Quality gates pass.\n- [ ] PR is squash-merged and final evidence is recorded.\n`,
);

write(
  "project-tracking/reports/0033-tray-runtime-consistency-report.md",
  `# 0033 - Tray Runtime Consistency Audit Report\n\n## Status\n\nImplementation in progress.\n\n## Audit method\n\nThe audit treated the Windows tray as a declared native product surface and traced startup settings, live language persistence, menu commands, selected-adapter dispatch, backend status commits, Tauri events and Main store ordering.\n\n## Confirmed defects\n\n1. **Tray localization drift.** Native labels and tooltip were hardcoded English and never followed persisted/live language.\n2. **Successful tray refresh was invisible to Main.** The backend state changed but no event updated the open webview.\n3. **Tray failures were log-only.** Refresh/Open Client errors provided no user-visible feedback.\n4. **Cross-channel status ordering was undefined.** A native result required selected-client scoping and timestamp freshness against frontend requests.\n\n## Corrections implemented\n\n- added pure English/Russian tray labels with English fallback;\n- retained native menu item and tray handles in managed state;\n- integrated tray language into runtime apply/persist/rollback;\n- added typed tray status and operation-error payloads;\n- emitted the exact backend Refresh result with the captured selected client;\n- added Main listeners and store handlers;\n- ignored inactive-client events;\n- preserved the freshest valid backend timestamp across tray/frontend channels;\n- reused existing visible notice and UIPI-aware error construction;\n- added Rust, frontend and source-contract regression coverage.\n\n## Screen and capability audit\n\nNo adapter capability was changed. Tray operations continue to dispatch through the selected adapter and existing backend capability enforcement. The work changes only localization, event delivery, ordering and error visibility.\n\n## Verification status\n\nPending exact-head Release Quality.\n`,
);
