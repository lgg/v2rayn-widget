use std::{
    fs::{self, File},
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    time::SystemTime,
};

use anyhow::{Context, Result};
use regex::Regex;

const MAX_LOG_TAIL_BYTES: u64 = 1024 * 1024;

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

    let content = read_log_tail(&log_path)?;
    Ok(parse_log_content(&content))
}

fn read_log_tail(path: &Path) -> Result<String> {
    let mut file = File::open(path)
        .with_context(|| format!("Failed to open log file: {}", path.display()))?;
    let length = file
        .metadata()
        .with_context(|| format!("Failed to read log metadata: {}", path.display()))?
        .len();
    let start = length.saturating_sub(MAX_LOG_TAIL_BYTES);
    file.seek(SeekFrom::Start(start))
        .with_context(|| format!("Failed to seek log file: {}", path.display()))?;

    let mut bytes = Vec::with_capacity((length - start).min(MAX_LOG_TAIL_BYTES) as usize);
    file.take(MAX_LOG_TAIL_BYTES)
        .read_to_end(&mut bytes)
        .with_context(|| format!("Failed to read log tail: {}", path.display()))?;

    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

fn find_latest_log_file(base_path: &Path) -> Option<PathBuf> {
    let logs_dir = base_path.join("guiLogs");
    let entries = fs::read_dir(&logs_dir).ok()?;

    let mut latest: Option<(PathBuf, SystemTime)> = None;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        let file_name = file_name.to_lowercase();
        if !(file_name.ends_with(".log") || file_name.ends_with(".txt")) {
            continue;
        }

        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let Ok(modified) = metadata.modified() else {
            continue;
        };

        match &latest {
            Some((latest_path, latest_time))
                if modified < *latest_time || (modified == *latest_time && path <= *latest_path) => {}
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
    use std::time::{SystemTime, UNIX_EPOCH};

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

    #[test]
    fn reads_only_the_bounded_tail_of_a_large_log() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("v2rayn-widget-large-log-{unique}.log"));
        let mut content = vec![b'x'; MAX_LOG_TAIL_BYTES as usize + 4096];
        content.extend_from_slice(b"\n[Info] latency = 42 ms\n");
        fs::write(&path, content).expect("write large log");

        let tail = read_log_tail(&path).expect("read tail");
        assert!(tail.len() <= MAX_LOG_TAIL_BYTES as usize + 3);
        assert!(tail.contains("latency = 42 ms"));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn latest_log_selection_ignores_non_log_entries() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let base = std::env::temp_dir().join(format!("v2rayn-widget-log-dir-{unique}"));
        let logs = base.join("guiLogs");
        fs::create_dir_all(&logs).expect("create logs");
        fs::write(logs.join("notes.json"), b"ignore").expect("write ignored");
        fs::write(logs.join("current.log"), b"use").expect("write log");

        assert_eq!(find_latest_log_file(&base), Some(logs.join("current.log")));
        let _ = fs::remove_dir_all(base);
    }
}
