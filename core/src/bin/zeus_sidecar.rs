use zeus_lib::sidecar::server;

#[tokio::main]
async fn main() {
    if let Err(e) = server::run().await {
        eprintln!("{{\"type\":\"error\",\"message\":{}}}", serde_json::to_string(&e.to_string()).unwrap_or_else(|_| "\"unknown\"".into()));
        std::process::exit(1);
    }
}
