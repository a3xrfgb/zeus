use crate::db::{self, Db};
use crate::models::manager;
use crate::state::InferenceHandle;
use std::path::Path;
use crate::sidecar::context::AppContext;

/// Stop the running `llama-server` so the next request loads with updated Settings (context, GPU layers, threads, etc.).
pub async fn restart_inference_engine(ctx: &AppContext) -> Result<(), String> {
    ctx.inference
        .0
        .stop_llama_server()
        .await
        .map_err(|e| e.to_string())
}

/// Load the chosen GGUF into `llama-server` immediately (only one model is loaded at a time).
/// Always evicts any previously resident weights (and mmproj stacks) before loading the new file.
pub async fn preload_chat_model(ctx: &AppContext, 
    model_id: String) -> Result<(), String> {
    let settings = {
        let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
        db::load_settings(&conn).map_err(|e| e.to_string())?
    };
    let model_id = manager::resolve_working_chat_model_id(&settings.data_dir, &model_id);
    let dir = manager::ensure_models_dir(Path::new(&settings.data_dir)).map_err(|e| e.to_string())?;
    let path = manager::resolve_gguf_path(&dir, &model_id)
        .ok_or_else(|| format!("model file not found for id {}", model_id))?;
    // Sidebar Load: unload previous model first so VRAM is freed, then load text-only weights.
    // (Vision/mmproj is attached later in chat only when the thread actually has media.)
    ctx.inference
        .0
        .stop_llama_server()
        .await
        .map_err(|e| e.to_string())?;
    ctx.inference
        .0
        .ensure_llama_server(path.as_path(), None, &settings)
        .await
        .map_err(|e| e.to_string())
        .map(|_| ())?;
    Ok(())
}
