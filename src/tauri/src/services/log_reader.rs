use std::{
    fs,
    path::{Path, PathBuf},
    time::SystemTime,
};

use anyhow::{Context, Result};
use regex::Regex;

#[derive(Debug, Clone, Default)]
pub struct LogSnapshot {
    pub last_error: Option<String>,
    pub last_event: Option<String>,
    pub latency_ms: Option<u64>,
    pub tun_ready: bool,
    pub startup_error: bool,
}

pub fn read_latest_log(base_path: &Path) -> Result<LogSnapshot> {
    let log_path =
        find_latest_log_file(base_path).ok_or_else(|| anyhow::anyhow!("No log files found in guiLogs"))?;

    let content = fs::read_to_string(&log_path)
        .with_context(|| format!("Failed to read log file: {}", log_path.display()))?;

    Ok(parse_log_content(&content))
}

fn find_latest_log_file(base_path: &Path) -> Option<PathBuf> {
    let logs_dir = base_path.join("guiLogs");
    if !logs_dir.exists() {
        return None;
    }

    let entries = fs::read_dir(&logs_dir).ok()?;

    let mut latest: Option<(PathBuf, SystemTime)> = None;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let file_name = path.file_name()?.to_str()?.to_lowercase();
        if !(file_name.ends_with(".log") || file_name.ends_with(".txt")) {
            continue;
        }

        let modified = entry.metadata().ok()?.modified().ok()?;
        match &latest {
            Some((_, latest_time)) if modified <= *latest_time => {}
            _ => latest = Some((path, modified)),
        }
    }

    latest.map(|(path, _)| path)
}

fn parse_log_content(content: &str) -> LogSnapshot {
    let mut snapshot = LogSnapshot::default();

    let error_regex = Regex::new(r"(?i)\b(error|failed|exception|panic)\b").expect("valid regex");
    let tun_ok_regex = Regex::new(r"(?i)\btun\b.*\b(started|enabled|running|ready)\b").expect("valid regex");
    let latency_regex = Regex::new(r"(?i)(delay|latency|ping|rtt)\D{0,20}(\d{1,5})\s?ms").expect("valid regex");
    let fallback_ms_regex = Regex::new(r"(?i)\b(\d{1,5})\s?ms\b").expect("valid regex");

    for line in content.lines().rev().take(1200) {
        let normalized = line.trim();
        if normalized.is_empty() {
            continue;
        }

        if snapshot.last_event.is_none() {
            snapshot.last_event = Some(normalized.to_owned());
        }

        if snapshot.last_error.is_none() && error_regex.is_match(normalized) {
            snapshot.last_error = Some(normalized.to_owned());
            snapshot.startup_error = true;
        }

        if !snapshot.tun_ready && tun_ok_regex.is_match(normalized) {
            snapshot.tun_ready = true;
        }

        if snapshot.latency_ms.is_none() {
            snapshot.latency_ms = extract_latency(normalized, &latency_regex, &fallback_ms_regex);
        }

        if snapshot.last_error.is_some() && snapshot.latency_ms.is_some() && snapshot.tun_ready {
            break;
        }
    }

    snapshot
}

fn extract_latency(line: &str, primary: &Regex, fallback: &Regex) -> Option<u64> {
    for regex in [primary, fallback] {
        if let Some(captures) = regex.captures(line) {
            if let Some(raw_value) = captures.get(2).or_else(|| captures.get(1)) {
                if let Ok(value) = raw_value.as_str().parse::<u64>() {
                    if (1..=5000).contains(&value) {
                        return Some(value);
                    }
                }
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_error_and_latency() {
        let content = "\
            [Info] TUN started successfully\n\
            [Debug] latency = 54 ms\n\
            [Error] failed to bind port\n";

        let parsed = parse_log_content(content);
        assert!(parsed.tun_ready);
        assert_eq!(parsed.latency_ms, Some(54));
        assert!(parsed.last_error.is_some());
    }

    #[test]
    fn parses_fallback_ms_pattern() {
        let content = "[Info] average 123ms";
        let parsed = parse_log_content(content);
        assert_eq!(parsed.latency_ms, Some(123));
    }
}
