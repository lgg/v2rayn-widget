pub fn detect_default_language() -> String {
    if let Some(locale) = sys_locale::get_locale() {
        let normalized = locale.to_lowercase();
        if normalized.starts_with("ru") {
            return "ru".to_owned();
        }

        if normalized.starts_with("en") {
            return "en".to_owned();
        }
    }

    "en".to_owned()
}
