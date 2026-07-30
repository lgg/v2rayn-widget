use tauri::{
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
        }
    } else {
        TrayLabels {
            show: "Show Widget",
            settings: "Settings",
            refresh: "Refresh Status",
            open_client: "Open Selected Client",
            exit: "Exit",
            tooltip: "Proxy Client Widget",
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

    pub fn apply_language(&self, language: &str) -> Result<(), String> {
        let labels = labels(language);
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

pub fn apply_language(app: &AppHandle, language: &str) -> Result<(), String> {
    app.state::<TrayMenuState>().apply_language(language)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn russian_language_uses_localized_tray_labels() {
        let labels = labels("ru-RU");
        assert_eq!(labels.show, "Показать виджет");
        assert_eq!(labels.refresh, "Обновить статус");
        assert_eq!(labels.tooltip, "Виджет прокси-клиента");
    }

    #[test]
    fn unknown_language_falls_back_to_english_labels() {
        let labels = labels("de");
        assert_eq!(labels.show, "Show Widget");
        assert_eq!(labels.open_client, "Open Selected Client");
        assert_eq!(labels.tooltip, "Proxy Client Widget");
    }
}
