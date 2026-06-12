use crate::db::{self, Db};
use crate::models::{manager, mmproj};
use crate::state::InferenceHandle;
use crate::types::{
    AppSettings, ImportReceiptImageResult, ReceiptVisionModelOption, ReceiptVisionResult,
    ReceiptVisionStatus,
};
use image::ImageFormat;
use serde::Deserialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::time::Duration;
use crate::sidecar::context::AppContext;
use uuid::Uuid;

const RECEIPT_IMAGE_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff",
];

const RECEIPTS_STORAGE_DIR: &str = "receipts";

const RECEIPT_PROMPT: &str = r#"You are a receipt extraction assistant. Read this receipt image carefully.
Reply with ONLY valid JSON (no markdown, no code fences, no extra text):
{
  "storeName": "company or store name",
  "itemType": "short description of goods or services purchased",
  "category": "food" | "transport" | "bills" | "rent" | "subscriptions" | "shopping" | "other",
  "totalAmount": 0.00,
  "currency": "USD" or "ETB" or null,
  "date": "YYYY-MM-DD",
  "items": ["line item 1", "line item 2"]
}
Use the receipt date when visible; otherwise use today's date. totalAmount must be the final amount paid (grand total)."#;

fn is_receipt_image_path(path: &str) -> bool {
    let lower = path.to_lowercase();
    RECEIPT_IMAGE_EXTENSIONS
        .iter()
        .any(|ext| lower.ends_with(&format!(".{ext}")))
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn canonicalize_lossy(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

fn normalize_path_key(path: &Path) -> String {
    let mut s = path.to_string_lossy().replace('\\', "/");
    if let Some(stripped) = s.strip_prefix("//?/") {
        s = stripped.to_string();
    }
    if let Some(stripped) = s.strip_prefix(r"\\?\") {
        s = stripped.replace('\\', "/");
    }
    s.to_lowercase()
}

fn path_is_within(child: &Path, parent: &Path) -> bool {
    let child_key = normalize_path_key(&canonicalize_lossy(child));
    let parent_key = normalize_path_key(&canonicalize_lossy(parent));
    let parent_prefix = format!("{}/", parent_key.trim_end_matches('/'));
    child_key == parent_key.trim_end_matches('/') || child_key.starts_with(&parent_prefix)
}

fn resolve_receipt_file(receipts_dir: &Path, image_path: &str) -> Result<PathBuf, String> {
    let requested = Path::new(image_path);
    let requested_name = requested
        .file_name()
        .and_then(|s| s.to_str())
        .map(str::to_lowercase);

    if requested.is_file() && path_is_within(requested, receipts_dir) {
        return Ok(canonicalize_lossy(requested));
    }

    let target_key = normalize_path_key(requested);
    for entry in fs::read_dir(receipts_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|s| s.to_str()) else {
            continue;
        };
        if !is_receipt_image_path(name) {
            continue;
        }
        let canon = canonicalize_lossy(&path);
        let name_matches = requested_name
            .as_ref()
            .is_some_and(|wanted| wanted == &name.to_lowercase());
        if normalize_path_key(&canon) == target_key || name_matches {
            return Ok(canon);
        }
    }

    if !requested.is_file() {
        return Ok(requested.to_path_buf());
    }

    Err("Receipt image is outside the Zeus receipts folder".into())
}

fn safe_receipt_filename(path: &Path) -> Result<String, String> {
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "Invalid receipt file name".to_string())?;
    let safe = name.replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], "_");
    if safe.is_empty() || !is_receipt_image_path(&safe) {
        return Err("Invalid receipt file name".into());
    }
    Ok(safe)
}

fn find_receipt_with_hash(receipts_dir: &Path, hash: &str) -> Option<PathBuf> {
    let entries = fs::read_dir(receipts_dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(name) = path.to_str() else {
            continue;
        };
        if !is_receipt_image_path(name) {
            continue;
        }
        let bytes = fs::read(&path).ok()?;
        if sha256_hex(&bytes) == hash {
            return Some(canonicalize_lossy(&path));
        }
    }
    None
}

fn transcode_image_bytes_to_png(bytes: &[u8]) -> Option<Vec<u8>> {
    let img = image::load_from_memory(bytes).ok()?;
    let mut out = Vec::new();
    img.write_to(&mut Cursor::new(&mut out), ImageFormat::Png).ok()?;
    Some(out)
}

fn mmproj_display_name(path: &Path) -> String {
    path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("mmproj")
        .to_string()
}

struct MediaSession {
    root: PathBuf,
    session: String,
    seq: u32,
}

impl MediaSession {
    fn new(root: PathBuf, session: String) -> Self {
        let _ = fs::create_dir_all(root.join(&session));
        Self {
            root,
            session,
            seq: 0,
        }
    }

    fn try_file_url_from_bytes(&mut self, suggested_name: &str, bytes: &[u8]) -> Result<String, String> {
        self.seq += 1;
        let (payload, fname) = if let Some(png) = transcode_image_bytes_to_png(bytes) {
            let stem = Path::new(suggested_name)
                .file_stem()
                .and_then(|s| s.to_str())
                .filter(|s| !s.is_empty())
                .unwrap_or("receipt");
            (png, format!("{:04}_{}.png", self.seq, stem))
        } else {
            let safe = suggested_name.replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], "_");
            (bytes.to_vec(), format!("{:04}_{}", self.seq, safe))
        };
        let path = self.root.join(&self.session).join(&fname);
        fs::write(&path, &payload).map_err(|e| e.to_string())?;
        let rel = format!("{}/{}", self.session, fname);
        Ok(format!("file://{}", rel.replace('\\', "/")))
    }
}

fn vision_model_rank(id: &str) -> (u32, String) {
    let lower = id.to_lowercase();
    let tier = if lower.contains("gemma") && lower.contains("e2b") {
        0
    } else if lower.contains("gemma") && lower.contains("e4b") {
        1
    } else if lower.contains("gemma") {
        2
    } else if lower.contains("qwen") {
        3
    } else {
        4
    };
    (tier, id.to_string())
}

fn list_vision_models(settings: &AppSettings) -> Vec<ReceiptVisionModelOption> {
    let dir = match manager::ensure_models_dir(Path::new(&settings.data_dir)) {
        Ok(d) => d,
        Err(_) => return Vec::new(),
    };
    let models = manager::scan_models(&dir, None).unwrap_or_default();
    let data_root = Path::new(&settings.data_dir);

    let mut out: Vec<ReceiptVisionModelOption> = Vec::new();
    for m in models {
        let id_lower = m.id.to_lowercase();
        if id_lower.contains("mmproj") {
            continue;
        }
        let Some(mmproj_path) = mmproj::resolve_mmproj_path(data_root, &m.id)
            .ok()
            .flatten()
        else {
            continue;
        };
        if manager::resolve_gguf_path(&dir, &m.id).is_none() {
            continue;
        }
        out.push(ReceiptVisionModelOption {
            id: m.id.clone(),
            name: m.name.clone(),
            mmproj_id: mmproj_display_name(&mmproj_path),
        });
    }
    out.sort_by(|a, b| {
        let ra = vision_model_rank(&a.id);
        let rb = vision_model_rank(&b.id);
        ra.0.cmp(&rb.0).then_with(|| ra.1.cmp(&rb.1))
    });
    out
}

fn resolve_vision_model_pair(
    settings: &AppSettings,
    model_id: Option<&str>) -> Result<(String, PathBuf, PathBuf), String> {
    let dir = manager::ensure_models_dir(Path::new(&settings.data_dir)).map_err(|e| e.to_string())?;
    let data_root = Path::new(&settings.data_dir);

    let pick = |id: &str| -> Result<(String, PathBuf, PathBuf), String> {
        let id = id.trim();
        let main_path = manager::resolve_gguf_path(&dir, id)
            .ok_or_else(|| format!("Main model weights not found for \"{id}\". Download the full bundle from Models."))?;
        let mmproj_path = mmproj::resolve_mmproj_path(data_root, id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| {
                format!(
                    "Vision projector (mmproj) not found for \"{id}\". Download the vision bundle (main GGUF + mmproj) from Models."
                )
            })?;
        Ok((id.to_string(), main_path, mmproj_path))
    };

    if let Some(id) = model_id.filter(|s| !s.trim().is_empty()) {
        return pick(id);
    }

    let models = list_vision_models(settings);
    let Some(first) = models.first() else {
        return Err(
            "No vision model found. Download a Gemma or Qwen vision bundle (main weights + mmproj) from Models.".into());
    };
    pick(&first.id)
}

fn assistant_final_text(stored: &str) -> String {
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(stored) {
        if let Some(final_text) = v.get("final").and_then(|x| x.as_str()) {
            return final_text.trim().to_string();
        }
    }
    stored.trim().to_string()
}

fn strip_json_fence(raw: &str) -> String {
    let mut s = raw.trim().to_string();
    if s.starts_with("```") {
        if let Some(start) = s.find('\n') {
            s = s[start + 1..].to_string();
        }
        if s.ends_with("```") {
            s.truncate(s.len().saturating_sub(3));
        }
        s = s.trim().to_string();
    }
    s
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReceiptModelJson {
    store_name: Option<String>,
    item_type: Option<String>,
    category: Option<String>,
    total_amount: Option<f64>,
    currency: Option<String>,
    date: Option<String>,
    items: Option<Vec<String>>,
}

fn normalize_category(raw: &str) -> String {
    match raw.trim().to_lowercase().as_str() {
        "food" => "food".to_string(),
        "transport" => "transport".to_string(),
        "bills" => "bills".to_string(),
        "rent" => "rent".to_string(),
        "subscriptions" | "subscription" => "subscriptions".to_string(),
        "shopping" => "shopping".to_string(),
        _ => "other".to_string(),
    }
}

fn today_iso() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

fn parse_receipt_json(raw: &str) -> Result<ReceiptVisionResult, String> {
    let cleaned = strip_json_fence(raw);
    let start = cleaned
        .find('{')
        .ok_or_else(|| format!("Model did not return JSON. Response: {}", truncate_for_error(&cleaned, 240)))?;
    let end = cleaned
        .rfind('}')
        .ok_or_else(|| format!("Model did not return JSON. Response: {}", truncate_for_error(&cleaned, 240)))?;
    let slice = &cleaned[start..=end];
    let parsed: ReceiptModelJson =
        serde_json::from_str(slice).map_err(|e| format!("Invalid receipt JSON ({e}). Raw: {}", truncate_for_error(slice, 240)))?;

    let store_name = parsed
        .store_name
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "Unknown store".to_string());
    let item_type = parsed
        .item_type
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "General purchase".to_string());
    let category = normalize_category(parsed.category.as_deref().unwrap_or("other"));
    let total_amount = parsed.total_amount.filter(|n| n.is_finite() && *n > 0.0).unwrap_or(0.0);
    let currency = parsed
        .currency
        .map(|c| c.trim().to_string())
        .filter(|c| !c.is_empty());
    let date = parsed
        .date
        .filter(|d| !d.trim().is_empty())
        .unwrap_or_else(today_iso);
    let items = parsed.items.unwrap_or_default();

    Ok(ReceiptVisionResult {
        store_name,
        item_type,
        category,
        total_amount,
        currency,
        date,
        items,
        raw_text: cleaned.to_string(),
        model_id: String::new(),
    })
}

fn truncate_for_error(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    format!("{}…", &s[..max])
}

fn receipts_dir_for_ctx(ctx: &AppContext) -> Result<PathBuf, String> {
    let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
    let settings = db::load_settings(&conn).map_err(|e| e.to_string())?;
    let receipts_dir = db::resolve_data_dir(&settings).join(RECEIPTS_STORAGE_DIR);
    fs::create_dir_all(&receipts_dir).map_err(|e| e.to_string())?;
    Ok(receipts_dir)
}

pub fn get_receipts_folder(ctx: &AppContext) -> Result<String, String> {
    let receipts_dir = receipts_dir_for_ctx(ctx)?;
    Ok(canonicalize_lossy(&receipts_dir).to_string_lossy().into_owned())
}

pub fn delete_receipt_image(ctx: &AppContext, image_path: String) -> Result<(), String> {
    if !is_receipt_image_path(&image_path) {
        return Err(format!(
            "Unsupported image type. Supported: {}",
            RECEIPT_IMAGE_EXTENSIONS.join(", ")
        ));
    }
    let receipts_dir = receipts_dir_for_ctx(ctx)?;
    let path = resolve_receipt_file(&receipts_dir, &image_path)?;
    if !path.is_file() {
        return Ok(());
    }
    fs::remove_file(&path).map_err(|e| format!("Failed to delete receipt image: {e}"))
}

pub fn list_receipt_images(ctx: &AppContext) -> Result<Vec<String>, String> {
    let receipts_dir = receipts_dir_for_ctx(ctx)?;
    let mut out = Vec::new();
    for entry in fs::read_dir(&receipts_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(name) = path.to_str() else {
            continue;
        };
        if !is_receipt_image_path(name) {
            continue;
        }
        out.push(canonicalize_lossy(&path).to_string_lossy().into_owned());
    }
    out.sort();
    Ok(out)
}

pub async fn get_receipt_vision_status(ctx: &AppContext) -> Result<ReceiptVisionStatus, String> {
    let settings = {
        let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
        db::load_settings(&conn).map_err(|e| e.to_string())?
    };
    let models = list_vision_models(&settings);
    if models.is_empty() {
        return Ok(ReceiptVisionStatus {
            ready: false,
            model_id: None,
            models,
            message:
                "No vision bundle found. Download main weights + mmproj together from Models (e.g. Gemma 4 E2B IT)."
                    .into(),
        });
    }
    let default_id = models[0].id.clone();
    let mmproj = models[0].mmproj_id.clone();
    Ok(ReceiptVisionStatus {
        ready: true,
        model_id: Some(default_id.clone()),
        models,
        message: format!("Ready — {default_id} + {mmproj}"),
    })
}

pub fn import_receipt_image(ctx: &AppContext, source: String) -> Result<ImportReceiptImageResult, String> {
    if !is_receipt_image_path(&source) {
        return Err(format!(
            "Unsupported image type. Supported: {}",
            RECEIPT_IMAGE_EXTENSIONS.join(", ")
        ));
    }
    let source_path = Path::new(&source);
    if !source_path.is_file() {
        return Err(format!("Receipt image not found: {source}"));
    }

    let receipts_dir = receipts_dir_for_ctx(ctx)?;

    if path_is_within(source_path, &receipts_dir) {
        return Ok(ImportReceiptImageResult {
            path: canonicalize_lossy(source_path).to_string_lossy().into_owned(),
            reused: true,
        });
    }

    let bytes = fs::read(source_path).map_err(|e| format!("Failed to read receipt image: {e}"))?;
    if bytes.is_empty() {
        return Err("Receipt image file is empty".into());
    }

    let hash = sha256_hex(&bytes);
    let safe_name = safe_receipt_filename(source_path)?;
    let named_dest = receipts_dir.join(&safe_name);

    if let Some(existing) = find_receipt_with_hash(&receipts_dir, &hash) {
        return Ok(ImportReceiptImageResult {
            path: existing.to_string_lossy().into_owned(),
            reused: true,
        });
    }

    if named_dest.is_file() {
        return Ok(ImportReceiptImageResult {
            path: canonicalize_lossy(&named_dest).to_string_lossy().into_owned(),
            reused: true,
        });
    }

    let dest = named_dest;
    fs::write(&dest, &bytes).map_err(|e| format!("Failed to copy receipt image: {e}"))?;
    Ok(ImportReceiptImageResult {
        path: canonicalize_lossy(&dest).to_string_lossy().into_owned(),
        reused: false,
    })
}

pub async fn extract_receipt_vision(ctx: &AppContext, 
    image_path: String,
    model_id: Option<String>) -> Result<ReceiptVisionResult, String> {
    if !is_receipt_image_path(&image_path) {
        return Err(format!(
            "Unsupported image type. Supported: {}",
            RECEIPT_IMAGE_EXTENSIONS.join(", ")
        ));
    }
    let path = PathBuf::from(&image_path);
    if !path.is_file() {
        return Err("Receipt image file not found".into());
    }

    let settings = {
        let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
        db::load_settings(&conn).map_err(|e| e.to_string())?
    };

    let (model_id, model_path, mmproj_path) =
        resolve_vision_model_pair(&settings, model_id.as_deref())?;

    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    if bytes.is_empty() {
        return Err("Receipt image file is empty".into());
    }

    let media_root = Path::new(&settings.data_dir).join("inference_media");
    let _ = fs::create_dir_all(&media_root);
    let session_id = Uuid::new_v4().to_string();
    let mut media_session = MediaSession::new(media_root.clone(), session_id.clone());
    let cleanup_dir = media_root.join(&session_id);

    let fname = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("receipt.png");
    let image_url = media_session.try_file_url_from_bytes(fname, &bytes)?;

    // Load main GGUF + mmproj together (same as chat vision / preload_chat_model).
    let session = ctx.inference
        .0
        .ensure_llama_server(
            model_path.as_path(),
            Some(mmproj_path.as_path()),
            &settings)
        .await
        .map_err(|e| {
            format!(
                "Failed to load \"{}\" with vision projector \"{}\": {e}",
                model_id,
                mmproj_display_name(&mmproj_path)
            )
        })?;
    let base = session.base_url;

    let messages = json!([
        {
            "role": "system",
            "content": "You extract structured data from receipt photos. Output JSON only."
        },
        {
            "role": "user",
            "content": [
                { "type": "text", "text": RECEIPT_PROMPT },
                { "type": "image_url", "image_url": { "url": image_url } }
            ]
        }
    ]);

    let reply = ctx.inference
        .0
        .chat_complete_messages_timeout(
            &base,
            messages,
            0.1,
            1024,
            json!({ "enable_thinking": false }),
            Duration::from_secs(600))
        .await
        .map_err(|e| format!("Vision extraction failed for \"{model_id}\": {e}"))?;

    let _ = fs::remove_dir_all(&cleanup_dir);

    let final_text = assistant_final_text(&reply);
    let mut result = parse_receipt_json(&final_text)?;
    result.model_id = model_id;
    Ok(result)
}

pub async fn preload_receipt_vision_model(ctx: &AppContext, 
    model_id: String) -> Result<(), String> {
    let settings = {
        let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
        db::load_settings(&conn).map_err(|e| e.to_string())?
    };
    let (id, model_path, mmproj_path) =
        resolve_vision_model_pair(&settings, Some(model_id.as_str()))?;
    ctx.inference
        .0
        .ensure_llama_server(
            model_path.as_path(),
            Some(mmproj_path.as_path()),
            &settings)
        .await
        .map_err(|e| {
            format!(
                "Failed to load \"{}\" with vision projector \"{}\": {e}",
                id,
                mmproj_display_name(&mmproj_path)
            )
        })
        .map(|_| ())?;
    Ok(())
}
