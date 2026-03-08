use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathValidation {
    pub is_valid: bool,
    pub message_key: String,
    pub normalized_path: String,
}
