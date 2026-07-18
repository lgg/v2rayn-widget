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
    Manager, WindowEvent,
};
use tracing::{error, info, warn};

use crate::{
    models::{settings::WindowPosition, status::DashboardStatus},
    services::privilege,
    state::app_state::AppState,
    utils::{logger, settings_store, window_visuals},
};

fn configure_webview2_user_data_dir() {
    let privilege_segment = match privilege::current_process_is_elevated() {
        Ok(true) => "admin",
        _ => "user",
    };

    let session_segment = {
        let pid = std::process::id();
        let millis = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|value| value.as_millis())
            .unwrap_or(0);
        format!("{pid}-{millis}")
    };

    let mut candidates = Vec::new();

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            candidates.push(
                parent
                    .join(".webview2")
                    .join(privilege_segment)
                    .join(&session_segment),
            );
        }
    }

    candidates.push(
        std::env::temp_dir()
            .join("v2rayn-widget")
            .join("webview2")
            .join(privilege_segment)
            .join(&session_segment),
    );

    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        candidates.push(
            std::path::PathBuf::from(local_app_data)
                .join("v2rayn-widget")
                .join("webview2")
                .join(privilege_segment)
                .join(&session_segment),
        );
    }

    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(
            current_dir
                .join(".webview2")
                .join(privilege_segment)
                .join(&session_segment),
        );
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

fn restore_visible_aux_windows(app: &tauri::AppHandle, context: &str) {
    let settings = app.state::<AppState>().snapshot().settings;

    for label in ["settings", "debug"] {
        if let Some(window) = app.get_webview_window(label) {
            if window.is_visible().unwrap_or(false) {
                let _ = window.show();
                let _ = window.unminimize();

                let _ = window.set_always_on_top(true);
                if !settings.always_on_top {
                    let _ = window.set_always_on_top(false);
                }

                info!(%label, %context, "restored visible auxiliary window");
            }
        }
    }
}

fn main() {
    configure_webview2_user_data_dir();

    if let Err(error) = logger::init_logging() {
        eprintln!("logging init failed: {error}");
    }

    let settings = settings_store::load_settings().unwrap_or_default();
    let state = AppState::new(settings.clone(), DashboardStatus::default());

    tauri::Builder::default()
        .manage(state)
        .setup(move |app| {
            let show_item = MenuItemBuilder::with_id("show", "Show Widget").build(app)?;
            let settings_item = MenuItemBuilder::with_id("settings", "Settings").build(app)?;
            let refresh_item = MenuItemBuilder::with_id("refresh", "Refresh Status").build(app)?;
            let open_item = MenuItemBuilder::with_id("open_client", "Open Selected Client").build(app)?;
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

            let mut tray_builder = TrayIconBuilder::new().tooltip("Proxy Client Widget").menu(&menu);
            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }

            let tray = tray_builder
                .on_menu_event(move |app, event| match event.id().0.as_str() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            restore_visible_aux_windows(app, "tray_show");
                        }
                    }
                    "settings" => {
                        if let Some(window) = app.get_webview_window("settings") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "refresh" => {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            let state = app_handle.state::<AppState>();
                            if let Ok(status) = client_commands::refresh_selected_client(state).await {
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
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            restore_visible_aux_windows(&app, "tray_left_click");
                        }
                    }
                })
                .build(app)?;

            app.manage(tray);

            if let Some(main_window) = app_handle.get_webview_window("main") {
                let _ = main_window.show();
                let _ = main_window.unminimize();
            }

            for label in ["main", "settings", "debug"] {
                if let Some(window) = app_handle.get_webview_window(label) {
                    let _ = window.set_always_on_top(settings.always_on_top);
                    let _ = window.set_resizable(false);

                    if label == "main" {
                        if let Some(bounds) = settings.window_position.clone() {
                            let _ = window.set_position(tauri::PhysicalPosition::new(bounds.x, bounds.y));
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
                        let _ = window.hide();
                    }
                    WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                        let state = app.state::<AppState>();
                        if let (Ok(position), Ok(size)) = (window.outer_position(), window.outer_size()) {
                            let mut snapshot = state.snapshot();
                            snapshot.settings.window_position = Some(WindowPosition {
                                x: position.x,
                                y: position.y,
                                width: size.width,
                                height: size.height,
                            });

                            if let Err(error) = settings_store::save_settings(&snapshot.settings) {
                                warn!(?error, "failed to persist window position");
                            } else {
                                state.update_settings(snapshot.settings.clone());
                            }
                        }
                    }
                    WindowEvent::Focused(is_focused) => {
                        if *is_focused {
                            restore_visible_aux_windows(&app, "main_focus_changed");
                        }
                    }
                    _ => {}
                },
                "settings" | "debug" => match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                    _ => {}
                },
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            client_commands::get_client_catalog,
            client_commands::get_selected_client,
            client_commands::select_client,
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
