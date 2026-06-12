//! Hugging Face download auth via `HF_TOKEN` / `HUGGINGFACE_HUB_TOKEN` environment variables.
use crate::db::Db;
use crate::types::DownloadProgress;
use futures_util::StreamExt;
use serde_json::json;
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use crate::sidecar::context::EventBus;

pub fn token_from_env() -> Option<String> {
    for key in ["HF_TOKEN", "HUGGINGFACE_HUB_TOKEN", "HUGGING_FACE_HUB_TOKEN"] {
        if let Ok(tok) = std::env::var(key) {
            let t = tok.trim().to_string();
            if !t.is_empty() {
                return Some(t);
            }
        }
    }
    None
}

pub fn resolve_huggingface_token() -> Option<String> {
    token_from_env()
}

pub fn resolve_huggingface_token_db(_db: &Db) -> Result<Option<String>, String> {
    Ok(token_from_env())
}

pub fn with_hf_auth(
    req: reqwest::RequestBuilder,
    token: Option<&str>) -> reqwest::RequestBuilder {
    match token.map(str::trim).filter(|t| !t.is_empty()) {
        Some(tok) => req.header("Authorization", format!("Bearer {tok}")),
        None => req,
    }
}

pub fn http_download_error(status: reqwest::StatusCode, file_label: &str, url: &str) -> String {
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return format!(
            "HTTP 401 downloading {file_label}. \
             Set HF_TOKEN in your environment for gated Hugging Face repos. \
             Create a token at huggingface.co/settings/tokens and accept any gated model licenses. \
             URL: {url}"
        );
    }
    format!("HTTP {status} downloading {file_label}")
}

pub async fn download_stream_to_file(
    events: &EventBus,
    hf_token: Option<&str>,
    model_id: &str,
    file_label: &str,
    url: &str,
    dest: &Path) -> Result<(), String> {
    if let Some(parent) = dest.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let client = reqwest::Client::builder()
        .user_agent(concat!(
            "Zeus/",
            env!("CARGO_PKG_VERSION"),
            " (Hugging Face downloader)"
        ))
        .build()
        .map_err(|e| e.to_string())?;
    let res = with_hf_auth(client.get(url), hf_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(http_download_error(res.status(), file_label, url));
    }
    let total = res.content_length().unwrap_or(0);
    let mut stream = res.bytes_stream();
    let mut file = File::create(dest).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        let pct = if total > 0 {
            (downloaded as f64 / total as f64) * 100.0
        } else {
            0.0
        };
        let _ = events.emit(
            "zeus-download-progress",
            json!(DownloadProgress {
                model_id: model_id.to_string(),
                bytes_downloaded: downloaded,
                total_bytes: total,
                percentage: pct,
                status: "downloading".into(),
            }));
    }
    let _ = events.emit(
        "zeus-download-progress",
        json!(DownloadProgress {
            model_id: model_id.to_string(),
            bytes_downloaded: downloaded,
            total_bytes: total,
            percentage: 100.0,
            status: "complete".into(),
        }));
    Ok(())
}
