mod chat_persist;
mod commands;
mod db;
mod tasks;
mod huggingface;
mod inference;
mod models;
mod state;
mod types;

pub mod sidecar;

/// Legacy Tauri entry point — use the `zeus-sidecar` binary for Electron.
pub fn run() {
    eprintln!("Zeus Tauri runtime is disabled. Use the zeus-sidecar binary.");
    std::process::exit(1);
}
