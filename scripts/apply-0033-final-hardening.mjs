import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8").replaceAll("\r\n", "\n");
}

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${count}`);
  }
  return source.replace(before, after);
}

function patch(path, replacements) {
  let source = read(path);
  for (const [before, after, label] of replacements) {
    source = replaceOnce(source, before, after, `${path}: ${label}`);
  }
  fs.writeFileSync(path, source, "utf8");
}

patch("src/frontend/src/features/dashboard-store.ts", [
  [
`      set((previous) => ({
        settings,
        clients,
        status: statusIsAtLeastAsFresh(status, previous.status)
          ? status
          : previous.status,
        profiles,
        pathNoticeKey: pathNoticeFor(settings),
        loading: false,
        error: null,
      }));`,
`      set((previous) => {
        const accept = statusIsAtLeastAsFresh(status, previous.status);
        return {
          settings,
          clients,
          status: accept ? status : previous.status,
          profiles: accept ? profiles : previous.profiles,
          pathNoticeKey: pathNoticeFor(settings),
          loading: false,
          error: null,
        };
      });`,
    "keep bootstrap status and profiles atomic",
  ],
  [
`  applyExternalOperationError: (payload) => {
    const fallback = payload.operation === "refresh"`,
`  applyExternalOperationError: (payload) => {
    if (get().settings?.selected_client !== payload.client_id) {
      return;
    }

    const fallback = payload.operation === "refresh"`,
    "scope tray errors to the active client",
  ],
]);

patch("src/frontend/src/lib/types.ts", [
  [
`export interface TrayOperationError {
  operation: "refresh" | "open_client";`,
`export interface TrayOperationError {
  client_id: ProxyClientId;
  operation: "refresh" | "open_client";`,
    "add tray error client identity",
  ],
]);

patch("src/frontend/src/features/dashboard-store-active-context.test.ts", [
  [
`  it("ignores tray status for an inactive client and surfaces tray errors", () => {
    useDashboardStore.getState().applyExternalStatus({
      client_id: "happ",
      status: connectedStatus("2026-07-31T00:00:03.000Z"),
    });
    expect(useDashboardStore.getState().status?.updated_at).toBe("initial");

    useDashboardStore.getState().applyExternalOperationError({
      operation: "open_client",
      message: "open failed from tray",
    });
    expect(useDashboardStore.getState().notice?.message).toBe(
      "open failed from tray",
    );
  });`,
`  it("keeps bootstrap status and profiles atomic when its response is stale", async () => {
    useDashboardStore.setState({
      status: connectedStatus("2026-07-31T00:00:04.000Z"),
      profiles: [{ id: "fresh", name: "fresh-profile" }],
    });
    apiMocks.getSettings.mockResolvedValueOnce(baseSettings);
    apiMocks.refreshSelectedClientStartup.mockResolvedValueOnce(
      connectedStatus("2026-07-31T00:00:03.000Z"),
    );
    apiMocks.listSelectedClientItems.mockResolvedValueOnce([
      { id: "stale", name: "stale-profile" },
    ]);

    await useDashboardStore.getState().bootstrap();

    expect(useDashboardStore.getState().status?.updated_at).toBe(
      "2026-07-31T00:00:04.000Z",
    );
    expect(useDashboardStore.getState().profiles).toEqual([
      { id: "fresh", name: "fresh-profile" },
    ]);
  });

  it("ignores inactive-client tray status and errors", () => {
    useDashboardStore.getState().applyExternalStatus({
      client_id: "happ",
      status: connectedStatus("2026-07-31T00:00:03.000Z"),
    });
    expect(useDashboardStore.getState().status?.updated_at).toBe("initial");

    useDashboardStore.getState().applyExternalOperationError({
      client_id: "happ",
      operation: "open_client",
      message: "stale Happ error",
    });
    expect(useDashboardStore.getState().notice).toBeNull();

    useDashboardStore.getState().applyExternalOperationError({
      client_id: "v2rayn",
      operation: "open_client",
      message: "open failed from tray",
    });
    expect(useDashboardStore.getState().notice?.message).toBe(
      "open failed from tray",
    );
  });`,
    "cover atomic bootstrap and scoped tray errors",
  ],
]);

patch("src/tauri/src/models/tray.rs", [
  [
`pub struct TrayOperationError {
    pub operation: TrayOperation,`,
`pub struct TrayOperationError {
    pub client_id: ProxyClientId,
    pub operation: TrayOperation,`,
    "add tray error client identity",
  ],
]);

patch("src/tauri/src/main.rs", [
  [
`fn emit_tray_operation_error(
    app: &tauri::AppHandle,
    operation: TrayOperation,
    message: String,
) {
    let payload = TrayOperationError { operation, message };`,
`fn emit_tray_operation_error(
    app: &tauri::AppHandle,
    client_id: crate::models::client::ProxyClientId,
    operation: TrayOperation,
    message: String,
) {
    let payload = TrayOperationError {
        client_id,
        operation,
        message,
    };`,
    "scope tray error payload",
  ],
  [
`                                    emit_tray_operation_error(
                                        &app_handle,
                                        TrayOperation::Refresh,
                                        error,
                                    );`,
`                                    emit_tray_operation_error(
                                        &app_handle,
                                        client_id,
                                        TrayOperation::Refresh,
                                        error,
                                    );`,
    "scope refresh error",
  ],
  [
`                        tauri::async_runtime::spawn(async move {
                            let state = app_handle.state::<AppState>();
                            if let Err(error) = client_commands::open_selected_client(state).await {
                                error!(?error, "open selected client from tray failed");
                                emit_tray_operation_error(
                                    &app_handle,
                                    TrayOperation::OpenClient,
                                    error,
                                );`,
`                        tauri::async_runtime::spawn(async move {
                            let state = app_handle.state::<AppState>();
                            let client_id = state.snapshot().settings.selected_client;
                            if let Err(error) = client_commands::open_selected_client(state).await {
                                error!(?error, "open selected client from tray failed");
                                emit_tray_operation_error(
                                    &app_handle,
                                    client_id,
                                    TrayOperation::OpenClient,
                                    error,
                                );`,
    "scope open-client error",
  ],
  [
`            app.manage(tray_menu::TrayMenuState::new(
                tray,
                show_item,
                settings_item,
                refresh_item,
                open_item,
                exit_item,
            ));

            if let Some(main_window) = app_handle.get_webview_window("main") {`,
`            app.manage(tray_menu::TrayMenuState::new(
                tray,
                show_item,
                settings_item,
                refresh_item,
                open_item,
                exit_item,
            ));

            if let Err(error) = tray_menu::apply_language(&app_handle, &settings.language) {
                warn!(?error, "failed to apply initial native shell language");
            }

            if let Some(main_window) = app_handle.get_webview_window("main") {`,
    "apply initial native shell language",
  ],
]);

patch("src/tauri/src/commands/mod.rs", [
  [
`    let window = WebviewWindowBuilder::new(&app, "diagnostics", WebviewUrl::External(url))
        .title("Diagnostics")`,
`    let window = WebviewWindowBuilder::new(&app, "diagnostics", WebviewUrl::External(url))
        .title(tray_menu::labels(&settings.language).diagnostics_title)`,
    "localize diagnostics title at creation",
  ],
]);

fs.writeFileSync(
  "src/tauri/src/utils/tray_menu.rs",
  String.raw`use tauri::{
    menu::MenuItem,
    tray::TrayIcon,
    AppHandle, Manager, Wry,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TrayLabels {
    pub show: &'static str,
    pub settings: &'static str,
    pub refresh: &'static str,
    pub open_client: &'static str,
    pub exit: &'static str,
    pub tooltip: &'static str,
    pub main_title: &'static str,
    pub settings_title: &'static str,
    pub debug_title: &'static str,
    pub happ_setup_title: &'static str,
    pub diagnostics_title: &'static str,
}

pub fn labels(language: &str) -> TrayLabels {
    if language.trim().to_lowercase().starts_with("ru") {
        TrayLabels {
            show: "Показать виджет",
            settings: "Настройки",
            refresh: "Обновить статус",
            open_client: "Открыть выбранный клиент",
            exit: "Выход",
            tooltip: "Виджет прокси-клиента",
            main_title: "Виджет прокси-клиента",
            settings_title: "Настройки виджета",
            debug_title: "Отладка виджета",
            happ_setup_title: "Настройка адаптера Happ",
            diagnostics_title: "Диагностика",
        }
    } else {
        TrayLabels {
            show: "Show Widget",
            settings: "Settings",
            refresh: "Refresh Status",
            open_client: "Open Selected Client",
            exit: "Exit",
            tooltip: "Proxy Client Widget",
            main_title: "Proxy Client Widget",
            settings_title: "Widget Settings",
            debug_title: "Widget Debug",
            happ_setup_title: "Happ Adapter Setup",
            diagnostics_title: "Diagnostics",
        }
    }
}

pub struct TrayMenuState {
    tray: TrayIcon<Wry>,
    show_item: MenuItem<Wry>,
    settings_item: MenuItem<Wry>,
    refresh_item: MenuItem<Wry>,
    open_item: MenuItem<Wry>,
    exit_item: MenuItem<Wry>,
}

impl TrayMenuState {
    pub fn new(
        tray: TrayIcon<Wry>,
        show_item: MenuItem<Wry>,
        settings_item: MenuItem<Wry>,
        refresh_item: MenuItem<Wry>,
        open_item: MenuItem<Wry>,
        exit_item: MenuItem<Wry>,
    ) -> Self {
        Self {
            tray,
            show_item,
            settings_item,
            refresh_item,
            open_item,
            exit_item,
        }
    }

    fn apply_labels(&self, labels: TrayLabels) -> Result<(), String> {
        self.show_item
            .set_text(labels.show)
            .map_err(|error| format!("Could not update tray Show label: {error}"))?;
        self.settings_item
            .set_text(labels.settings)
            .map_err(|error| format!("Could not update tray Settings label: {error}"))?;
        self.refresh_item
            .set_text(labels.refresh)
            .map_err(|error| format!("Could not update tray Refresh label: {error}"))?;
        self.open_item
            .set_text(labels.open_client)
            .map_err(|error| format!("Could not update tray Open Client label: {error}"))?;
        self.exit_item
            .set_text(labels.exit)
            .map_err(|error| format!("Could not update tray Exit label: {error}"))?;
        self.tray
            .set_tooltip(Some(labels.tooltip))
            .map_err(|error| format!("Could not update tray tooltip: {error}"))?;
        Ok(())
    }
}

fn apply_window_titles(app: &AppHandle, labels: TrayLabels) -> Result<(), String> {
    for (label, title) in [
        ("main", labels.main_title),
        ("settings", labels.settings_title),
        ("debug", labels.debug_title),
        ("happ-setup", labels.happ_setup_title),
        ("diagnostics", labels.diagnostics_title),
    ] {
        if let Some(window) = app.get_webview_window(label) {
            window.set_title(title).map_err(|error| {
                format!("Could not update native title for window '{label}': {error}")
            })?;
        }
    }
    Ok(())
}

pub fn apply_language(app: &AppHandle, language: &str) -> Result<(), String> {
    let labels = labels(language);
    app.state::<TrayMenuState>().apply_labels(labels)?;
    apply_window_titles(app, labels)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn russian_language_uses_localized_native_labels() {
        let labels = labels("ru-RU");
        assert_eq!(labels.show, "Показать виджет");
        assert_eq!(labels.refresh, "Обновить статус");
        assert_eq!(labels.tooltip, "Виджет прокси-клиента");
        assert_eq!(labels.settings_title, "Настройки виджета");
        assert_eq!(labels.diagnostics_title, "Диагностика");
    }

    #[test]
    fn unknown_language_falls_back_to_english_native_labels() {
        let labels = labels("de");
        assert_eq!(labels.show, "Show Widget");
        assert_eq!(labels.open_client, "Open Selected Client");
        assert_eq!(labels.tooltip, "Proxy Client Widget");
        assert_eq!(labels.debug_title, "Widget Debug");
        assert_eq!(labels.diagnostics_title, "Diagnostics");
    }
}
`,
  "utf8",
);

patch("src/tauri/tests/product_surface_contracts.rs", [
  [
`#[test]
fn tray_runtime_is_localized_and_reports_native_operation_results() {
    let main = include_str!("../src/main.rs");
    assert!(main.contains("tray_menu::labels(&settings.language)"));
    assert!(main.contains("app_handle.emit(\"tray-status-updated\", payload)"));
    assert!(main.contains("emit_tray_operation_error("));

    let commands = include_str!("../src/commands/mod.rs");
    assert!(commands.contains("tray_menu::apply_language(app, &next.language)"));
    assert!(commands.contains("tray_menu::apply_language(app, &previous.language)"));

    let app = include_str!("../../frontend/src/app/App.tsx");
    assert!(app.contains(
        "bindTauriListener<TrayStatusUpdate>(\"tray-status-updated\""
    ));
    assert!(app.contains(
        "bindTauriListener<TrayOperationError>(\"tray-operation-error\""
    ));
}`,
`#[test]
fn tray_runtime_is_localized_and_reports_native_operation_results() {
    let main = include_str!("../src/main.rs");
    assert!(main.contains("tray_menu::labels(&settings.language)"));
    assert!(main.contains("tray_menu::apply_language(&app_handle, &settings.language)"));
    assert!(main.contains("app_handle.emit(\"tray-status-updated\", payload)"));
    assert!(main.contains("emit_tray_operation_error("));

    let commands = include_str!("../src/commands/mod.rs");
    assert!(commands.contains("tray_menu::apply_language(app, &next.language)"));
    assert!(commands.contains("tray_menu::apply_language(app, &previous.language)"));
    assert!(commands.contains(
        ".title(tray_menu::labels(&settings.language).diagnostics_title)"
    ));

    let tray = include_str!("../src/utils/tray_menu.rs");
    assert!(tray.contains("window.set_title(title)"));
    assert!(tray.contains("app.state::<TrayMenuState>().apply_labels(labels)?"));

    let app = include_str!("../../frontend/src/app/App.tsx");
    assert!(app.contains(
        "bindTauriListener<TrayStatusUpdate>(\"tray-status-updated\""
    ));
    assert!(app.contains(
        "bindTauriListener<TrayOperationError>(\"tray-operation-error\""
    ));

    let store = include_str!("../../frontend/src/features/dashboard-store.ts");
    assert!(store.contains("get().settings?.selected_client !== payload.client_id"));
    assert!(store.contains("profiles: accept ? profiles : previous.profiles"));
}`,
    "cover native titles, scoped errors and atomic bootstrap",
  ],
]);

patch("docs/architecture.md", [
  [
`The tray menu is initialized from the persisted application language and retains live menu-item/tray handles so a successful language patch updates every label and tooltip immediately. Runtime language changes participate in the same apply/persist/rollback transaction as always-on-top and autostart.

Tray Refresh executes the selected adapter's backend refresh and emits a typed client-scoped status event to Main. Main ignores inactive-client events and compares backend timestamps so an older in-flight frontend response cannot overwrite a newer tray result. Refresh and Open Client failures emit typed operation errors and use the same visible notice/UIPI handling as equivalent Main actions.`,
`The tray menu is initialized from the persisted application language and retains live menu-item/tray handles so a successful language patch updates every label, tooltip and native window title immediately. Runtime language changes participate in the same apply/persist/rollback transaction as always-on-top and autostart. Diagnostics uses the current language when its external webview is created later.

Tray Refresh executes the selected adapter's backend refresh and emits a typed client-scoped status event to Main. Main ignores inactive-client status and error events, compares backend timestamps so an older in-flight frontend response cannot overwrite a newer tray result, and accepts status/profile pairs atomically. Refresh and Open Client failures use the same visible notice/UIPI handling as equivalent Main actions.`,
    "document final native runtime invariants",
  ],
]);
