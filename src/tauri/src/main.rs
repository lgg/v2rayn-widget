#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod adapters;
mod client_commands;
mod commands;
mod models;
mod services;
mod state;
mod utils;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, Runtime, WebviewWindow, WindowEvent,
};
use tracing::{error, info, warn};

use crate::{
    models::{settings::WindowPosition, status::DashboardStatus},
    services::privilege,
    state::app_state::AppState,
    utils::{logger, settings_store, window_position, window_visuals},
};

fn configure_webview2_user_data_dir() {
    let privilege_segment = match privilege::current_process_is_elevated() {
        Ok(true) => "admin",
        _ => "user",
    };

    let mut candidates = Vec::new();
    let mut add_candidate = |candidate: std::path::PathBuf| {
        if !candidates.contains(&candidate) {
            candidates.push(candidate);
        }
    };

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            add_candidate(parent.join(".webview2").join(privilege_segment));
        }
    }

    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        add_candidate(
            std::path::PathBuf::from(local_app_data)
                .join("v2rayn-widget")
                .join("webview2")
                .join(privilege_segment),
        );
    }

    add_candidate(
        std::env::temp_dir()
            .join("v2rayn-widget")
            .join("webview2")
            .join(privilege_segment),
    );

    if let Ok(current_dir) = std::env::current_dir() {
        add_candidate(current_dir.join(".webview2").join(privilege_segment));
    }

    for candidate in candidates {
        if prepare_webview2_candidate(&candidate) {
            std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", &candidate);
            info!(path = %candidate.display(), "configured WEBVIEW2_USER_DATA_FOLDER");
            return;
        }

        warn!(path = %candidate.display(), "webview2 candidate unavailable");
    }

    std::env::remove_var("WEBVIEW2_USER_DATA_FOLDER");
    warn!("failed to configure dedicated WEBVIEW2_USER_DATA_FOLDER; using WebView2 default");
}

fn prepare_webview2_candidate(path: &std::path::Path) -> bool {
    if std::fs::create_dir_all(path).is_err() {
        return false;
    }

    let probe = path.join(".rw-probe");
    if std::fs::write(&probe, b"ok").is_err() {
        return false;
    }

    let _ = std::fs::remove_file(probe);
    true
}

fn window_is_resizable(label: &str) -> bool {
    matches!(label, "main" | "debug")
}

fn show_unminimize_focus<R: Runtime>(window: &WebviewWindow<R>, context: &str) {
    let label = window.label();
    if let Err(error) = window.show() {
        warn!(?error, %label, %context, "failed to show window");
    }
    if let Err(error) = window.unminimize() {
        warn!(?error, %label, %context, "failed to unminimize window");
    }
    if let Err(error) = window.set_focus() {
        warn!(?error, %label, %context, "failed to focus window");
    }
}

fn restore_visible_aux_windows(app: &tauri::AppHandle, context: &str) {
    let settings = app.state::<AppState>().snapshot().settings;

    for label in ["settings", "debug", "happ-setup"] {
        if let Some(window) = app.get_webview_window(label) {
            match window.is_visible() {
                Ok(true) => {
                    if let Err(error) = window.show() {
                        warn!(?error, %label, %context, "failed to show auxiliary window");
                    }
                    if let Err(error) = window.unminimize() {
                        warn!(?error, %label, %context, "failed to unminimize auxiliary window");
                    }
                    if let Err(error) = window.set_always_on_top(true) {
                        warn!(?error, %label, %context, "failed to raise auxiliary window");
                    }
                    if !settings.always_on_top {
                        if let Err(error) = window.set_always_on_top(false) {
                            warn!(?error, %label, %context, "failed to restore auxiliary always-on-top state");
                        }
                    }
                    info!(%label, %context, "restored visible auxiliary window");
                }
                Ok(false) => {}
                Err(error) => {
                    warn!(?error, %label, %context, "failed to inspect auxiliary window visibility")
                }
            }
        }
    }
}

fn main() {
    configure_webview2_user_data_dir();

    if let Err(error) = logger::init_logging() {
        eprintln!("logging init failed: {error}");
    }

    let settings = match settings_store::load_settings() {
        Ok(settings) => settings,
        Err(error) => {
            error!(?error, "failed to load settings; using in-memory defaults");
            Default::default()
        }
    };
    let state = AppState::new(settings.clone(), DashboardStatus::default());

    tauri::Builder::default()
        .manage(state)
        .setup(move |app| {
            let show_item = MenuItemBuilder::with_id("show", "Show Widget").build(app)?;
            let settings_item = MenuItemBuilder::with_id("settings", "Settings").build(app)?;
            let refresh_item = MenuItemBuilder::with_id("refresh", "Refresh Status").build(app)?;
            let open_item =
                MenuItemBuilder::with_id("open_client", "Open Selected Client").build(app)?;
            let exit_item = MenuItemBuilder::with_id("exit", "Exit").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&settings_item)
                .item(&refresh_item)
                .item(&open_item)
                .separator()
                .item(&exit_item)
                .build()?;

            let app_handle = app.handle().clone();

            let mut tray_builder = TrayIconBuilder::new()
                .tooltip("Proxy Client Widget")
                .menu(&menu);
            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }

            let tray = tray_builder
                .on_menu_event(move |app, event| match event.id().0.as_str() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            show_unminimize_focus(&window, "tray_show");
                            restore_visible_aux_windows(app, "tray_show");
                        }
                    }
                    "settings" => {
                        if let Some(window) = app.get_webview_window("settings") {
                            show_unminimize_focus(&window, "tray_settings");
                        }
                    }
                    "refresh" => {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            let state = app_handle.state::<AppState>();
                            if let Ok(status) =
                                client_commands::refresh_selected_client(state).await
                            {
                                info!(?status.connection_state, "refresh from tray succeeded");
                            }
                        });
                    }
                    "open_client" => {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            let state = app_handle.state::<AppState>();
                            if let Err(error) = client_commands::open_selected_client(state).await {
                                error!(?error, "open selected client from tray failed");
                            }
                        });
                    }
                    "exit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            show_unminimize_focus(&window, "tray_left_click");
                            restore_visible_aux_windows(app, "tray_left_click");
                        }
                    }
                })
                .build(app)?;

            app.manage(tray);

            if let Some(main_window) = app_handle.get_webview_window("main") {
                show_unminimize_focus(&main_window, "startup");
            }

            for label in ["main", "settings", "debug", "happ-setup"] {
                if let Some(window) = app_handle.get_webview_window(label) {
                    if let Err(error) = window.set_always_on_top(settings.always_on_top) {
                        warn!(?error, %label, "failed to apply initial always-on-top state");
                    }
                    if let Err(error) = window.set_resizable(window_is_resizable(label)) {
                        warn!(?error, %label, "failed to apply initial resizable state");
                    }

                    if label == "main" {
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

                    if let Err(error) = window_visuals::apply_window_visuals(&window, &settings) {
                        warn!(?error, %label, "failed to apply initial window visuals");
                    }
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            let app = window.app_handle();

            match window.label() {
                "main" => match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        if let Err(error) = window.hide() {
                            warn!(?error, "failed to hide main window");
                        }
                    }
                    WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                        let state = app.state::<AppState>();
                        let _settings_update = state.lock_settings_update();
                        if let (Ok(position), Ok(size)) =
                            (window.outer_position(), window.outer_size())
                        {
                            if let Some(revision) =
                                state.update_window_position(WindowPosition {
                                    x: position.x,
                                    y: position.y,
                                    width: size.width,
                                    height: size.height,
                                })
                            {
                                let app_handle = app.clone();
                                tauri::async_runtime::spawn(async move {
                                    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
                                    let state = app_handle.state::<AppState>();
                                    let _settings_update = state.lock_settings_update();
                                    if !state.window_position_revision_is_current(revision) {
                                        return;
                                    }
                                    let settings = state.snapshot().settings;
                                    if let Err(error) = settings_store::save_settings(&settings) {
                                        warn!(?error, "failed to persist debounced window position");
                                    }
                                });
                            }
                        }
                    }
                    WindowEvent::Focused(true) => {
                        restore_visible_aux_windows(app, "main_focus_changed");
                    }
                    _ => {}
                },
                "settings" => {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        if let Err(error) = window.emit("settings-close-requested", ()) {
                            warn!(?error, "failed to forward native settings close request; leaving the window visible to avoid discarding an unsaved draft");
                        }
                    }
                }
                "happ-setup" => {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        if let Err(error) = window.emit("happ-setup-close-requested", ()) {
                            warn!(?error, "failed to forward native Happ setup close request; leaving the window visible to avoid discarding an unsaved draft");
                        }
                    }
                }
                "debug" => {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        if let Err(error) = window.hide() {
                            warn!(?error, "failed to hide debug window");
                        }
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            client_commands::get_client_catalog,
            client_commands::get_selected_client,
            client_commands::get_selected_client_diagnostics,
            client_commands::get_happ_diagnostics,
            client_commands::probe_happ_candidate,
            client_commands::open_happ_setup_window,
            client_commands::select_client,
            client_commands::detect_happ_path,
            client_commands::validate_happ_path,
            client_commands::update_happ_settings,
            client_commands::refresh_selected_client,
            client_commands::refresh_selected_client_background,
            client_commands::refresh_selected_client_startup,
            client_commands::refresh_selected_client_post_route,
            client_commands::toggle_selected_client,
            client_commands::list_selected_client_items,
            client_commands::select_client_item,
            client_commands::open_selected_client,
            commands::get_status,
            commands::refresh_status,
            commands::refresh_status_post_route,
            commands::refresh_status_background,
            commands::refresh_status_startup,
            commands::toggle_tun_via_ui,
            commands::set_active_profile,
            commands::open_v2rayn,
            commands::restart_v2rayn,
            commands::get_settings,
            commands::update_settings,
            commands::apply_ui_settings,
            commands::open_settings_window,
            commands::open_debug_window,
            commands::open_diagnostics_window,
            commands::run_ui_debug_probe,
            commands::debug_toggle_via_ui_only,
            commands::debug_click_reload_via_ui,
            commands::debug_select_profile_via_ui,
            commands::debug_capture_runtime_snapshot,
            commands::debug_toggle_via_config_only,
            commands::relaunch_widget_as_admin,
            commands::detect_v2rayn_path,
            commands::validate_v2rayn_path,
            commands::get_available_locales,
            commands::list_profiles,
            commands::close_window,
            commands::set_main_window_height,
            commands::exit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::window_is_resizable;

    #[test]
    fn initial_window_resizability_matches_tauri_configuration() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).expect("valid Tauri config");
        let windows = config
            .get("app")
            .and_then(|value| value.get("windows"))
            .and_then(serde_json::Value::as_array)
            .expect("Tauri windows array");

        for window in windows {
            let label = window
                .get("label")
                .and_then(serde_json::Value::as_str)
                .expect("window label");
            let configured = window
                .get("resizable")
                .and_then(serde_json::Value::as_bool)
                .expect("window resizable flag");
            assert_eq!(
                window_is_resizable(label),
                configured,
                "runtime resizability drifted from Tauri config for {label}"
            );
        }
    }
}
