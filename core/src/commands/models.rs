use crate::db::{self, Db};
use crate::models::manager;
use crate::models::registry;
use crate::state::InferenceHandle;
use crate::types::ModelInfo;
use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};
use crate::sidecar::context::AppContext;

fn models_dir_from_settings(settings: &crate::types::AppSettings) -> Result<PathBuf, String> {
    let data = db::resolve_data_dir(settings);
    manager::ensure_models_dir(&data).map_err(|e| e.to_string())
}

pub async fn list_local_models(ctx: &AppContext) -> Result<Vec<ModelInfo>, String> {
    let settings = {
        let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
        db::load_settings(&conn).map_err(|e| e.to_string())?
    };
    let dir = models_dir_from_settings(&settings)?;
    let active_s = ctx.inference
        .0
        .active_model_path()
        .await
        .map(|p| p.to_string_lossy().to_string());
    manager::scan_models(&dir, active_s.as_deref()).map_err(|e| e.to_string())
}

pub async fn download_model(ctx: &AppContext, 
    model_id: String,
    url: String) -> Result<(), String> {
    let (dest_dir, hf_token) = {
        let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
        let settings = db::load_settings(&conn).map_err(|e| e.to_string())?;
        (models_dir_from_settings(&settings)?, crate::huggingface::resolve_huggingface_token())
    };
    let filename = format!("{}.gguf", sanitize_filename(&model_id));
    let dest = dest_dir.join(&filename);
    crate::huggingface::download_stream_to_file(
        &ctx.events,
        hf_token.as_deref(),
        &model_id,
        &filename,
        &url,
        &dest)
    .await
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BundleFile {
    pub id: String,
    pub url: String,
}

/// Downloads main GGUF + mmproj (and any extra files) into `models/<bundle_subdir>/`.
pub async fn download_model_bundle(ctx: &AppContext, 
    bundle_subdir: String,
    files: Vec<BundleFile>) -> Result<(), String> {
    if files.is_empty() {
        return Ok(());
    }
    let (dest_root, hf_token) = {
        let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
        let settings = db::load_settings(&conn).map_err(|e| e.to_string())?;
        (models_dir_from_settings(&settings)?, crate::huggingface::resolve_huggingface_token())
    };
    let folder = sanitize_filename(&bundle_subdir);
    let bundle_dir = dest_root.join(&folder);
    fs::create_dir_all(&bundle_dir).map_err(|e| e.to_string())?;

    for f in files {
        let name = format!("{}.gguf", sanitize_filename(&f.id));
        let dest = bundle_dir.join(&name);
        crate::huggingface::download_stream_to_file(
            &ctx.events,
            hf_token.as_deref(),
            &f.id,
            &name,
            &f.url,
            &dest)
        .await?;
    }
    Ok(())
}

fn sanitize_filename(s: &str) -> String {
    // Keep `.` so `Qwen3.5-9B-…` matches catalog ids and `list_local_models` stems.
    s.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

pub fn delete_model(ctx: &AppContext, model_id: String) -> Result<(), String> {
    let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
    let settings = db::load_settings(&conn).map_err(|e| e.to_string())?;
    let dir = models_dir_from_settings(&settings)?;
    manager::delete_model_artifacts(&dir, &model_id).map_err(|e| e.to_string())
}

pub fn get_model_info(ctx: &AppContext, model_id: String) -> Result<ModelInfo, String> {
    let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
    let settings = db::load_settings(&conn).map_err(|e| e.to_string())?;
    let dir = models_dir_from_settings(&settings)?;
    let list = manager::scan_models(&dir, None).map_err(|e| e.to_string())?;
    list.into_iter()
        .find(|m| m.id == model_id)
        .ok_or_else(|| "model not found".to_string())
}

pub async fn list_registry_models(ctx: &AppContext) -> Result<Vec<crate::types::RegistryModel>, String> {
    registry::fetch_hf_gguf_models()
        .await
        .map_err(|e| e.to_string())
}
