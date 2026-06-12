use crate::db;
use crate::inference::engine::InferenceEngine;
use crate::sidecar::context::{AppContext, EventBus};
use crate::sidecar::dispatch;
use crate::state::{InferenceHandle, StreamCancel};
use axum::{extract::State, routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;

#[derive(Deserialize)]
struct InvokeRequest {
    cmd: String,
    args: serde_json::Value,
}

#[derive(Serialize)]
struct InvokeResponse {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

struct AppState {
    ctx: Arc<AppContext>,
}

async fn invoke_handler(
    State(st): State<Arc<AppState>>,
    Json(req): Json<InvokeRequest>) -> Json<InvokeResponse> {
    match dispatch::dispatch(&st.ctx, &req.cmd, req.args).await {
        Ok(result) => Json(InvokeResponse {
            ok: true,
            result: Some(result),
            error: None,
        }),
        Err(e) => Json(InvokeResponse {
            ok: false,
            result: None,
            error: Some(e),
        }),
    }
}

fn spawn_event_stdout(mut rx: broadcast::Receiver<(String, serde_json::Value)>) {
    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok((event, payload)) => {
                    let msg = serde_json::json!({
                        "type": "event",
                        "event": event,
                        "payload": payload,
                    });
                    println!("{}", msg);
                }
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    });
}

pub async fn run() -> Result<(), String> {
    let home = std::env::var("ZEUS_DATA_DIR")
        .map(std::path::PathBuf::from)
        .or_else(|_| {
            dirs::home_dir()
                .map(|h| h.join(".zeus"))
                .ok_or_else(|| "no home dir".to_string())
        })?;
    std::fs::create_dir_all(&home).map_err(|e| e.to_string())?;
    let db_path = db::default_db_path(&home);
    let conn = db::open(&db_path).map_err(|e| e.to_string())?;
    db::init_db(&conn).map_err(|e| e.to_string())?;
    let db = db::Db(Arc::new(std::sync::Mutex::new(conn)));
    let inference = InferenceHandle(Arc::new(InferenceEngine::new()));
    let cancel = StreamCancel::default();
    let (events, event_rx) = EventBus::new();
    spawn_event_stdout(event_rx);

    let ctx = Arc::new(AppContext {
        db,
        inference,
        cancel,
        events,
    });

    let app_state = Arc::new(AppState { ctx });
    let app = Router::new()
        .route("/invoke", post(invoke_handler))
        .with_state(app_state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| e.to_string())?;
    let port = listener
        .local_addr()
        .map_err(|e| e.to_string())?
        .port();

    println!("{{\"type\":\"ready\",\"port\":{port}}}");
    // Pipe stdout is block-buffered — flush so Electron sees ready immediately.
    use std::io::Write;
    let _ = std::io::stdout().flush();

    axum::serve(listener, app)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
