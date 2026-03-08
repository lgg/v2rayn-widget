use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocaleInfo {
    pub code: String,
    pub label: String,
    pub native_label: String,
}
