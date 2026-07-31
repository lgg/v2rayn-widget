use tauri::{menu::MenuItem, tray::TrayIcon, AppHandle, Manager, Wry};

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
