use crate::db::Db;
use crate::state::{InferenceHandle, StreamCancel};
use tokio::sync::broadcast;

pub struct EventBus {
    tx: broadcast::Sender<(String, serde_json::Value)>,
}

impl Clone for EventBus {
    fn clone(&self) -> Self {
        Self { tx: self.tx.clone() }
    }
}

impl EventBus {
    pub fn new() -> (Self, broadcast::Receiver<(String, serde_json::Value)>) {
        let (tx, rx) = broadcast::channel(8192);
        (Self { tx }, rx)
    }

    pub fn emit(&self, event: &str, payload: serde_json::Value) {
        let _ = self.tx.send((event.to_string(), payload));
    }
}

pub struct AppContext {
    pub db: Db,
    pub inference: InferenceHandle,
    pub cancel: StreamCancel,
    pub events: EventBus,
}

pub fn scripts_dir() -> String {
    std::env::var("ZEUS_SCRIPTS_DIR")
        .unwrap_or_else(|_| format!("{}/scripts", env!("CARGO_MANIFEST_DIR")))
}
