use crate::inference::llama_binary::{
    append_llama_launch_log, configure_llama_child, cuda_runtime_dlls_present,
    detect_llama_backend, missing_cuda_runtime_dlls, resolve_llama_server_binary,
};
use crate::models::{gguf_meta, mmproj};
use crate::types::AppSettings;
use anyhow::{anyhow, Context, Result};
use futures_util::StreamExt;
use reqwest::header::ACCEPT;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time::sleep;

/// Fingerprint of llama-server CLI options — restart when this or model path changes.
pub fn inference_launch_snapshot(settings: &AppSettings) -> String {
    serde_json::json!({
        "ngl": settings.gpu_layers,
        "cpu_threads": settings.cpu_threads,
        "batch": settings.inference_batch_size,
        "ubatch": settings.inference_ubatch_size,
        "parallel": settings.inference_parallel,
        "fa": settings.inference_flash_attn,
        "mmap": settings.inference_mmap,
        "mlock": settings.inference_mlock,
        "kvo": settings.inference_kv_offload,
        "kvu": settings.inference_kv_unified,
        "rope_base": settings.rope_freq_base,
        "rope_scale": settings.rope_freq_scale,
        "seed": settings.inference_seed,
        "ctk": settings.inference_cache_type_k,
        "ctv": settings.inference_cache_type_v,
        "ctx": settings.context_length,
        "media_path_mmproj": settings.data_dir.clone(),
    })
    .to_string()
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ChatMsg {
    pub role: String,
    pub content: String,
}

/// Usage / finish metadata from chat completion (streaming or not).
#[derive(Default, Clone, Debug)]
pub struct StreamUsage {
    pub prompt_tokens: Option<u32>,
    pub completion_tokens: Option<u32>,
    pub finish_reason: Option<String>,
}

struct Inner {
    child: Option<Child>,
    base_url: Option<String>,
    active_model: Option<PathBuf>,
    /// When set, `llama-server` was started with `--mmproj` (vision / multimodal).
    active_mmproj: Option<PathBuf>,
    /// From GET `/v1/models` after load — must match `model` in `/v1/chat/completions` (LM Studio / OpenAI clients do the same).
    openai_model_id: Option<String>,
    /// Last successful `inference_launch_snapshot(settings)` so ctx/ngl/thread changes restart the server.
    active_launch_snapshot: Option<String>,
}

pub struct InferenceEngine {
    inner: Mutex<Inner>,
}

/// Result of [`InferenceEngine::ensure_llama_server`].
#[derive(Debug, Clone)]
pub struct LlamaServerSession {
    pub base_url: String,
    /// `true` when the server process was killed and started again for this call.
    pub restarted: bool,
}

impl Default for InferenceEngine {
    fn default() -> Self {
        Self {
            inner: Mutex::new(Inner {
                child: None,
                base_url: None,
                active_model: None,
                active_mmproj: None,
                openai_model_id: None,
                active_launch_snapshot: None,
            }),
        }
    }
}

impl InferenceEngine {
    pub fn new() -> Self {
        Self::default()
    }

    /// Whether a `llama-server` binary is present under `~/.zeus/llama-cpp` (or `ZEUS_LLAMA_SERVER`).
    pub fn is_llama_server_installed() -> bool {
        resolve_llama_server_binary().is_some()
    }

    async fn kill_child(&self) -> Result<()> {
        let mut g = self.inner.lock().await;
        if let Some(mut c) = g.child.take() {
            let _ = c.kill();
            let _ = c.wait();
        }
        g.base_url = None;
        g.active_model = None;
        g.active_mmproj = None;
        g.openai_model_id = None;
        g.active_launch_snapshot = None;
        Ok(())
    }

    /// Stop `llama-server` so the next chat loads with updated Settings (context, GPU layers, etc.).
    pub async fn stop_llama_server(&self) -> Result<()> {
        self.kill_child().await
    }

    /// Resolved id for OpenAI-compatible calls (same as LM Studio: use server's model id).
    pub async fn openai_model_id(&self) -> Option<String> {
        self.inner.lock().await.openai_model_id.clone()
    }

    async fn fetch_openai_model_id(&self, base: &str) -> Option<String> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .ok()?;
        let url = format!("{}/v1/models", base.trim_end_matches('/'));
        let v: serde_json::Value = client.get(&url).send().await.ok()?.json().await.ok()?;
        v["data"]
            .as_array()?
            .first()?
            .get("id")?
            .as_str()
            .map(|s| s.to_string())
    }

    fn same_mmproj(a: Option<&Path>, b: &Option<PathBuf>) -> bool {
        match (a, b.as_ref()) {
            (None, None) => true,
            (Some(p), Some(q)) => p == q.as_path(),
            _ => false,
        }
    }

    /// Prism ML Bonsai / Q1_0_g128: stock ggml-org `llama-server` cannot load these GGUFs.
    fn enrich_llama_ready_error(model_path: &Path, e: anyhow::Error) -> anyhow::Error {
        let base = e.to_string();
        let lossy = model_path.to_string_lossy().to_ascii_lowercase();
        let prism_q1_in_file =
            gguf_meta::gguf_file_contains(model_path, b"Q1_0_g128", 16 * 1024 * 1024);
        let prism_name_hint = lossy.contains("bonsai") || lossy.contains("q1_0_g128");
        if prism_q1_in_file || prism_name_hint {
            return anyhow::anyhow!(
                "{}\n\nThis model uses Prism ML Q1_0_g128 (1-bit) weights. The standard ggml-org llama.cpp binary used by Zeus cannot load this format. Build `llama-server` from https://github.com/PrismML-Eng/llama.cpp (CUDA or Metal), then set the environment variable ZEUS_LLAMA_SERVER to that executable’s full path (Windows: full path to llama-server.exe), or replace the file under ~/.zeus/llama-cpp/. See: https://huggingface.co/prism-ml/Bonsai-8B-gguf",
                base
            );
        }
        e
    }

    fn paths_equal(a: &Path, b: &Path) -> bool {
        if a == b {
            return true;
        }
        match (std::fs::canonicalize(a), std::fs::canonicalize(b)) {
            (Ok(ca), Ok(cb)) => ca == cb,
            _ => false,
        }
    }

    fn is_child_running(g: &mut Inner) -> bool {
        let Some(child) = g.child.as_mut() else {
            return false;
        };
        matches!(child.try_wait(), Ok(None))
    }

    fn server_matches(
        g: &mut Inner,
        model_path: &Path,
        mmproj_path: Option<&Path>,
        snap: &str,
    ) -> Option<String> {
        if !Self::is_child_running(g) {
            return None;
        }
        let url = g.base_url.as_ref()?;
        let am = g.active_model.as_ref()?;
        let ss = g.active_launch_snapshot.as_ref()?;
        if Self::paths_equal(am.as_path(), model_path)
            && Self::same_mmproj(mmproj_path, &g.active_mmproj)
            && ss == snap
        {
            Some(url.clone())
        } else {
            None
        }
    }

    /// Whether the next [`ensure_llama_server`] call would kill and respawn `llama-server`.
    pub async fn llama_server_would_restart(
        &self,
        model_path: &Path,
        mmproj_path: Option<&Path>,
        settings: &AppSettings,
    ) -> bool {
        let snap = inference_launch_snapshot(settings);
        let mut g = self.inner.lock().await;
        Self::server_matches(&mut g, model_path, mmproj_path, &snap).is_none()
    }

    /// Ensure `llama-server` is running for the given GGUF path.
    /// Pass `mmproj_path` only when the request is multimodal (image/audio/video).
    pub async fn ensure_llama_server(
        &self,
        model_path: &Path,
        mmproj_path: Option<&Path>,
        settings: &AppSettings) -> Result<LlamaServerSession> {
        let model_path =
            std::fs::canonicalize(model_path).unwrap_or_else(|_| model_path.to_path_buf());
        let snap = inference_launch_snapshot(settings);
        {
            let mut g = self.inner.lock().await;
            if let Some(url) = Self::server_matches(&mut g, &model_path, mmproj_path, &snap) {
                return Ok(LlamaServerSession {
                    base_url: url,
                    restarted: false,
                });
            }
        }
        self.kill_child().await?;

        let bin = resolve_llama_server_binary().ok_or_else(|| {
            anyhow!(
                "llama-server not found in ~/.zeus/llama-cpp. Open Settings → Runtime and click Download & install to get the CUDA 12 build, or set ZEUS_LLAMA_SERVER to the full path of llama-server.exe."
            )
        })?;

        let ctx_size =
            gguf_meta::resolve_server_context_tokens(&model_path, settings.context_length);
        let gpu_layers = settings.gpu_layers;

        if gpu_layers != 0 {
            if let Some(bin_dir) = bin.parent() {
                if detect_llama_backend(bin_dir) == "cpu" {
                    let ngl = if gpu_layers < 0 {
                        "auto".to_string()
                    } else {
                        gpu_layers.to_string()
                    };
                    return Err(anyhow!(
                        "GPU acceleration is enabled (GPU layers: {ngl}) but the llama-server in ~/.zeus/llama-cpp is not the CUDA build (no ggml-cuda.dll). Open Settings → Runtime and click Download & install. Binary: {}",
                        bin.display()
                    ));
                }
                if !cuda_runtime_dlls_present(bin_dir) {
                    let missing = missing_cuda_runtime_dlls(bin_dir).join(", ");
                    return Err(anyhow!(
                        "GPU acceleration is enabled but NVIDIA CUDA runtime DLLs are missing from ~/.zeus/llama-cpp ({missing}). \
                         Open Settings → Runtime and click Download & install — Zeus needs both zips: \
                         llama-<tag>-bin-win-cuda-12.4-x64.zip and cudart-llama-bin-win-cuda-12.4-x64.zip."
                    ));
                }
            }
        }

        let port = TcpListener::bind("127.0.0.1:0")?
            .local_addr()?
            .port();

        let fallback_id = model_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("model")
            .to_string();

        let mut cmd = Command::new(&bin);
        cmd.arg("-m").arg(&model_path);
        if let Some(mp) = mmproj_path {
            cmd.arg("--mmproj").arg(mp);
            // LM Studio / llama.cpp: multimodal `file://…` URLs (see --media-path). Avoids fragile huge `data:…;base64,…` in JSON.
            // https://github.com/ggml-org/llama.cpp/pull/17697
            let media_root = Path::new(&settings.data_dir).join("inference_media");
            let _ = std::fs::create_dir_all(&media_root);
            cmd.arg("--media-path").arg(&media_root);
        }
        cmd.arg("--host").arg("127.0.0.1");
        cmd.arg("--port").arg(port.to_string());
        // Stable API name (matches /v1/models and OpenAI-style clients).
        cmd.arg("-a").arg(&fallback_id);
        let ngl = if gpu_layers < 0 {
            "auto".to_string()
        } else {
            gpu_layers.to_string()
        };
        cmd.arg("-ngl").arg(&ngl);
        if ctx_size > 0 {
            cmd.arg("-c").arg(ctx_size.to_string());
        }

        if settings.cpu_threads >= 1 {
            cmd.arg("-t").arg(settings.cpu_threads.to_string());
        }
        if settings.inference_batch_size >= 32 {
            cmd.arg("-b").arg(settings.inference_batch_size.to_string());
        }
        if settings.inference_ubatch_size >= 32 {
            cmd.arg("-ub").arg(settings.inference_ubatch_size.to_string());
        }
        if settings.inference_parallel >= 1 {
            cmd.arg("-np").arg(settings.inference_parallel.to_string());
        } else if ctx_size > 64 * 1024 {
            // Huge context × auto parallel slots (4) balloons VRAM and load time; one slot is enough for chat.
            cmd.arg("-np").arg("1");
        }

        let fa = settings.inference_flash_attn.trim();
        if fa.eq_ignore_ascii_case("on") {
            cmd.arg("-fa").arg("on");
        } else if fa.eq_ignore_ascii_case("off") {
            cmd.arg("-fa").arg("off");
        }
        // "auto" or empty: rely on server default

        if !settings.inference_mmap {
            cmd.arg("--no-mmap");
        }
        if settings.inference_mlock {
            cmd.arg("--mlock");
        }
        if !settings.inference_kv_offload {
            cmd.arg("--no-kv-offload");
        }
        if !settings.inference_kv_unified {
            cmd.arg("--no-kv-unified");
        }

        if settings.rope_freq_base > 0.0 {
            cmd
                .arg("--rope-freq-base")
                .arg(settings.rope_freq_base.to_string());
        }
        if settings.rope_freq_scale > 0.0 {
            cmd
                .arg("--rope-freq-scale")
                .arg(settings.rope_freq_scale.to_string());
        }
        if settings.inference_seed >= 0 {
            cmd.arg("-s").arg(settings.inference_seed.to_string());
        }
        let ctk = settings.inference_cache_type_k.trim();
        if !ctk.is_empty() {
            cmd.arg("-ctk").arg(ctk);
        }
        let ctv = settings.inference_cache_type_v.trim();
        if !ctv.is_empty() {
            cmd.arg("-ctv").arg(ctv);
        }

        let model_stem = model_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        let _gemma4 = mmproj::looks_like_gemma_4_model_id(model_stem);
        // Gemma 4 thinking is controlled per request via `chat_template_kwargs`
        // (`enable_thinking`, `reasoning_budget`) — do not force `--reasoning off` here
        // or the composer Think toggle cannot show reasoning.

        configure_llama_child(&mut cmd, &bin);
        append_llama_launch_log(
            &bin,
            &format!(
                "args: -ngl {ngl} -c {ctx_size} -m {}",
                model_path.display(),
            ),
        );

        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::null());
        if let Some(home) = dirs::home_dir() {
            let log_dir = home.join(".zeus").join("logs");
            if std::fs::create_dir_all(&log_dir).is_ok() {
                let log_path = log_dir.join("llama-server.log");
                if let Ok(f) = std::fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&log_path)
                {
                    cmd.stderr(Stdio::from(f));
                } else {
                    cmd.stderr(Stdio::null());
                }
            } else {
                cmd.stderr(Stdio::null());
            }
        } else {
            cmd.stderr(Stdio::null());
        }

        let child = cmd.spawn().with_context(|| {
            format!(
                "spawn llama-server (binary {:?}). Is llama.cpp on PATH?",
                bin
            )
        })?;

        let base = format!("http://127.0.0.1:{port}");
        let path_for_hint = model_path.clone();
        {
            let mut g = self.inner.lock().await;
            g.child = Some(child);
            g.base_url = Some(base.clone());
            g.active_model = Some(model_path);
            g.active_mmproj = mmproj_path.map(|p| p.to_path_buf());
            g.active_launch_snapshot = Some(snap);
        }

        if let Err(e) = self.wait_ready(&base).await {
            let _ = self.kill_child().await;
            return Err(Self::enrich_llama_ready_error(&path_for_hint, e));
        }

        let oid = self
            .fetch_openai_model_id(&base)
            .await
            .unwrap_or(fallback_id);
        {
            let mut g = self.inner.lock().await;
            g.openai_model_id = Some(oid);
        }

        Ok(LlamaServerSession {
            base_url: base,
            restarted: true,
        })
    }

    async fn wait_ready(&self, base: &str) -> Result<()> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()?;
        // Prefer /v1/models with non-empty data — server can expose /health before weights are ready.
        for _ in 0..180u32 {
            let models_url = format!("{}/v1/models", base.trim_end_matches('/'));
            if let Ok(r) = client.get(&models_url).send().await {
                if r.status().is_success() {
                    if let Ok(v) = r.json::<serde_json::Value>().await {
                        if v["data"]
                            .as_array()
                            .map(|a| !a.is_empty())
                            .unwrap_or(false)
                        {
                            return Ok(());
                        }
                    }
                }
            }
            let health_url = format!("{}/health", base.trim_end_matches('/'));
            if let Ok(r) = client.get(&health_url).send().await {
                if r.status().is_success() {
                    return Ok(());
                }
            }
            if let Ok(r) = client.get(base).send().await {
                if r.status().is_success() {
                    return Ok(());
                }
            }
            sleep(Duration::from_millis(500)).await;
        }
        Err(anyhow!(
            "llama-server did not become ready in time. See ~/.zeus/logs/llama-server.log and verify the GGUF path, VRAM, and llama.cpp build."
        ))
    }

    fn message_text_field(msg: &serde_json::Value, key: &str) -> String {
        match msg.get(key) {
            Some(serde_json::Value::String(s)) if !s.trim().is_empty() => s.trim().to_string(),
            Some(serde_json::Value::Array(parts)) => parts
                .iter()
                .filter_map(|p| {
                    if p.get("type").and_then(|t| t.as_str()) == Some("text") {
                        p.get("text").and_then(|t| t.as_str())
                    } else {
                        p.as_str()
                    }
                })
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>()
                .join(""),
            _ => String::new(),
        }
    }

    /// Parse `{ "v": 1, "thinking": "...", "final": "..." }` stored in SQLite.
    pub fn parse_assistant_blob(blob: &str) -> (String, String) {
        let t = blob.trim();
        if !t.starts_with('{') {
            return (String::new(), t.to_string());
        }
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(t) {
            if v.get("v").and_then(|x| x.as_u64()) == Some(1) {
                let thinking = v
                    .get("thinking")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .trim()
                    .to_string();
                let final_text = v
                    .get("final")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .trim()
                    .to_string();
                return (thinking, final_text);
            }
        }
        (String::new(), t.to_string())
    }

    /// When Think UI is off, show one ChatGPT-style answer instead of an empty final + hidden reasoning.
    pub fn merge_thinking_into_answer_if_needed(
        thinking: &mut String,
        final_text: &mut String,
        show_thinking_separately: bool,
    ) {
        if !show_thinking_separately && final_text.trim().is_empty() && !thinking.trim().is_empty() {
            *final_text = std::mem::take(thinking);
        }
    }

    /// LM Studio–style: never persist or show a completely blank assistant turn.
    pub fn finalize_assistant_turn(
        thinking: &mut String,
        final_text: &mut String,
        show_thinking_separately: bool,
    ) {
        *thinking = Self::strip_gemma_placeholder_tokens(thinking);
        *final_text = Self::strip_gemma_placeholder_tokens(final_text);
        Self::merge_thinking_into_answer_if_needed(thinking, final_text, show_thinking_separately);
        if final_text.trim().is_empty() && !thinking.trim().is_empty() {
            *final_text = thinking.clone();
        }
    }

    /// Qwen3 / DeepSeek-style: `reasoning_content` + `content` in message.
    pub fn extract_assistant_parts(v: &serde_json::Value) -> (String, String, Option<serde_json::Value>) {
        let usage = v.get("usage").cloned();
        let Some(choice0) = v["choices"].get(0) else {
            return (String::new(), String::new(), usage);
        };
        let msg = &choice0["message"];
        let mut thinking = Self::message_text_field(msg, "reasoning_content");
        if thinking.is_empty() {
            thinking = Self::message_text_field(msg, "reasoning");
        }
        let mut final_text = Self::message_text_field(msg, "content");
        thinking = Self::strip_gemma_placeholder_tokens(&thinking);
        final_text = Self::strip_gemma_placeholder_tokens(&final_text);
        (thinking, final_text, usage)
    }

    /// JSON stored in DB for assistant messages (parsed in UI). Falls back to plain text when no extras.
    pub fn assistant_blob_json(
        thinking: &str,
        final_text: &str,
        gen_ms: Option<u64>,
        usage: &StreamUsage) -> String {
        let tokens_per_sec = match (gen_ms, usage.completion_tokens) {
            (Some(ms), Some(ct)) if ms > 0 => {
                let sec = ms as f64 / 1000.0;
                if sec > 0.001 {
                    Some(ct as f64 / sec)
                } else {
                    None
                }
            }
            _ => None,
        };
        let thin = thinking.trim();
        let fin = final_text.trim();
        if thin.is_empty()
            && gen_ms.is_none()
            && usage.completion_tokens.is_none()
            && usage.prompt_tokens.is_none()
            && usage.finish_reason.is_none()
        {
            return fin.to_string();
        }
        json!({
            "v": 1,
            "thinking": thin,
            "final": fin,
            "genMs": gen_ms,
            "tokensPerSec": tokens_per_sec,
            "completionTokens": usage.completion_tokens,
            "promptTokens": usage.prompt_tokens,
            "finishReason": usage.finish_reason,
        })
        .to_string()
    }

    fn merge_stream_usage(acc: &mut StreamUsage, v: &serde_json::Value) {
        if let Some(u) = v.get("usage") {
            if let Some(n) = u["completion_tokens"].as_u64() {
                acc.completion_tokens = Some(n as u32);
            }
            if let Some(n) = u["prompt_tokens"].as_u64() {
                acc.prompt_tokens = Some(n as u32);
            }
        }
        if let Some(choice) = v["choices"].get(0) {
            if let Some(fr) = choice["finish_reason"].as_str() {
                if !fr.is_empty() {
                    acc.finish_reason = Some(fr.to_string());
                }
            }
        }
    }

    /// `native_thinking`: pass `true` when the composer Think bulb is on (Qwen3-style models).
    pub async fn chat_complete(
        &self,
        base: &str,
        messages: Vec<ChatMsg>,
        temperature: f32,
        max_tokens: u32,
        chat_template_kwargs: serde_json::Value) -> Result<String> {
        let model = self
            .inner
            .lock()
            .await
            .openai_model_id
            .clone()
            .ok_or_else(|| {
                anyhow!(
                    "inference server is not ready (missing model id). Select your model again or check ~/.zeus/logs/llama-server.log"
                )
            })?;

        let client = reqwest::Client::new();
        let url = format!("{}/v1/chat/completions", base.trim_end_matches('/'));
        let body = json!({
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": false,
            "chat_template_kwargs": chat_template_kwargs,
        });
        let res = client
            .post(&url)
            .header(ACCEPT, "application/json")
            .json(&body)
            .send()
            .await
            .with_context(|| format!("POST {url}"))?;
        let status = res.status();
        if !status.is_success() {
            let t = res.text().await.unwrap_or_default();
            return Err(anyhow!("inference error {}: {}", status, t));
        }
        let v: serde_json::Value = res.json().await?;
        let (thinking, final_text, _) = Self::extract_assistant_parts(&v);
        let mut u = StreamUsage::default();
        Self::merge_stream_usage(&mut u, &v);
        let content = Self::assistant_blob_json(&thinking, &final_text, None, &u);
        Ok(content)
    }

    /// Non-streaming completion with arbitrary OpenAI-style message JSON (multimodal / vision).
    pub async fn chat_complete_messages(
        &self,
        base: &str,
        messages: serde_json::Value,
        temperature: f32,
        max_tokens: u32,
        chat_template_kwargs: serde_json::Value) -> Result<String> {
        self.chat_complete_messages_timeout(
            base,
            messages,
            temperature,
            max_tokens,
            chat_template_kwargs,
            Duration::from_secs(120))
        .await
    }

    /// Same as [`Self::chat_complete_messages`] with an explicit HTTP timeout (vision can be slow).
    pub async fn chat_complete_messages_timeout(
        &self,
        base: &str,
        messages: serde_json::Value,
        temperature: f32,
        max_tokens: u32,
        chat_template_kwargs: serde_json::Value,
        timeout: Duration) -> Result<String> {
        let model = self
            .inner
            .lock()
            .await
            .openai_model_id
            .clone()
            .ok_or_else(|| {
                anyhow!(
                    "inference server is not ready (missing model id). Select your model again or check ~/.zeus/logs/llama-server.log"
                )
            })?;

        let client = reqwest::Client::builder()
            .timeout(timeout)
            .build()
            .context("build inference HTTP client")?;
        let url = format!("{}/v1/chat/completions", base.trim_end_matches('/'));
        let body = json!({
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": false,
            "chat_template_kwargs": chat_template_kwargs,
        });
        let res = client
            .post(&url)
            .header(ACCEPT, "application/json")
            .json(&body)
            .send()
            .await
            .with_context(|| format!("POST {url}"))?;
        let status = res.status();
        if !status.is_success() {
            let t = res.text().await.unwrap_or_default();
            return Err(anyhow!("inference error {}: {}", status, t));
        }
        let v: serde_json::Value = res.json().await?;
        let (thinking, final_text, _) = Self::extract_assistant_parts(&v);
        let mut u = StreamUsage::default();
        Self::merge_stream_usage(&mut u, &v);
        let content = Self::assistant_blob_json(&thinking, &final_text, None, &u);
        Ok(content)
    }

    /// Gemma 4 streams internal `<unusedN>` placeholders; strip before UI / storage.
    pub fn strip_gemma_placeholder_tokens(s: &str) -> String {
        let mut out = String::with_capacity(s.len());
        let mut rest = s;
        while let Some(start) = rest.find("<unused") {
            out.push_str(&rest[..start]);
            match rest[start..].find('>') {
                Some(end_rel) => rest = &rest[start + end_rel + 1..],
                None => {
                    out.push_str(&rest[start..]);
                    return out;
                }
            }
        }
        out.push_str(rest);
        out
    }

    fn stream_delta_reasoning(delta: &serde_json::Value) -> Option<&str> {
        delta["reasoning_content"]
            .as_str()
            .or_else(|| delta["reasoning"].as_str())
            .filter(|s| !s.is_empty())
    }

    fn stream_delta_content(delta: &serde_json::Value) -> Option<&str> {
        delta["content"]
            .as_str()
            .or_else(|| delta["text"].as_str())
            .filter(|s| !s.is_empty())
    }

    /// OpenAI-style streams may send incremental tokens or cumulative text; skip exact repeats.
    fn stream_piece_to_emit<'a>(emitted: &str, chunk: &'a str) -> Option<&'a str> {
        if chunk.is_empty() {
            return None;
        }
        if emitted.is_empty() {
            return Some(chunk);
        }
        if chunk.starts_with(emitted) {
            let rest = &chunk[emitted.len()..];
            if rest.is_empty() {
                return None;
            }
            return Some(rest);
        }
        Some(chunk)
    }

    fn emit_stream_delta<F>(on_delta: &mut F, text: &str, is_reasoning: bool, any_delta: &mut bool) -> bool
    where
        F: FnMut(&str, bool) -> bool,
    {
        let text = Self::strip_gemma_placeholder_tokens(text);
        if text.is_empty() {
            return true;
        }
        *any_delta = true;
        on_delta(&text, is_reasoning)
    }

    fn emit_stream_piece<F>(
        emitted: &mut String,
        on_delta: &mut F,
        chunk: &str,
        is_reasoning: bool,
        any_delta: &mut bool,
    ) -> bool
    where
        F: FnMut(&str, bool) -> bool,
    {
        let Some(piece) = Self::stream_piece_to_emit(emitted, chunk) else {
            return true;
        };
        emitted.push_str(piece);
        Self::emit_stream_delta(on_delta, piece, is_reasoning, any_delta)
    }

    /// OpenAI-compatible streaming; `on_delta(text, is_reasoning)` — reasoning deltas first from many servers.
    /// `include_reasoning_stream`: when `true`, parse both `reasoning_content` and `content` (with duplicate
    /// suppression). The composer Think toggle only controls how the UI routes reasoning vs answer tokens.
    pub async fn chat_complete_stream_json<F>(
        &self,
        base: &str,
        messages: serde_json::Value,
        temperature: f32,
        max_tokens: u32,
        chat_template_kwargs: serde_json::Value,
        include_reasoning_stream: bool,
        mut on_delta: F) -> Result<StreamUsage>
    where
        F: FnMut(&str, bool) -> bool,
    {
        let model = self
            .inner
            .lock()
            .await
            .openai_model_id
            .clone()
            .ok_or_else(|| {
                anyhow!(
                    "inference server is not ready (missing model id). Select your model again or check ~/.zeus/logs/llama-server.log"
                )
            })?;

        let client = reqwest::Client::new();
        let url = format!("{}/v1/chat/completions", base.trim_end_matches('/'));
        let body = json!({
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": true,
            "stream_options": { "include_usage": true },
            "chat_template_kwargs": chat_template_kwargs,
        });
        let res = client
            .post(&url)
            .header(ACCEPT, "text/event-stream")
            .json(&body)
            .send()
            .await
            .with_context(|| format!("POST stream {url}"))?;
        if !res.status().is_success() {
            let t = res.text().await.unwrap_or_default();
            return Err(anyhow!("inference stream error: {}", t));
        }
        let mut stream = res.bytes_stream();
        let mut buf = Vec::new();
        let mut usage = StreamUsage::default();
        let mut any_delta = false;
        let mut emitted_content = String::new();
        let mut emitted_reasoning = String::new();
        let mut last_msg_content: Option<String> = None;
        let mut last_msg_reasoning: Option<String> = None;
        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            buf.extend_from_slice(&chunk);
            while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
                let line: Vec<u8> = buf.drain(..=pos).collect();
                let line = String::from_utf8_lossy(&line);
                let line = line.trim();
                if line.is_empty() || line == "data: [DONE]" {
                    continue;
                }
                let payload = line.strip_prefix("data: ").unwrap_or(line);
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(payload) {
                    Self::merge_stream_usage(&mut usage, &v);
                    if let Some(choice) = v["choices"].get(0) {
                        if let Some(msg) = choice.get("message") {
                            if let Some(full) = Self::stream_delta_content(msg) {
                                last_msg_content = Some(full.to_string());
                            }
                            if let Some(full) = Self::stream_delta_reasoning(msg) {
                                last_msg_reasoning = Some(full.to_string());
                            }
                        }
                        let delta = &choice["delta"];
                        let r = Self::stream_delta_reasoning(delta);
                        let c = Self::stream_delta_content(delta);

                        // Some Gemma / llama-server builds mirror the same incremental text in both
                        // `reasoning_content` and `content`. Emitting both produces WordWord-style
                        // duplication in the UI (and doubles the stored answer).
                        if include_reasoning_stream {
                            match (r, c) {
                                (Some(rv), Some(cv)) if rv == cv => {
                                    if !Self::emit_stream_piece(
                                        &mut emitted_content,
                                        &mut on_delta,
                                        cv,
                                        false,
                                        &mut any_delta,
                                    ) {
                                        return Ok(usage);
                                    }
                                }
                                _ => {
                                    if let Some(rv) = r {
                                        if !Self::emit_stream_piece(
                                            &mut emitted_reasoning,
                                            &mut on_delta,
                                            rv,
                                            true,
                                            &mut any_delta,
                                        ) {
                                            return Ok(usage);
                                        }
                                    }
                                    if let Some(cv) = c {
                                        if r.map(|rv| rv != cv).unwrap_or(true)
                                            && !Self::emit_stream_piece(
                                                &mut emitted_content,
                                                &mut on_delta,
                                                cv,
                                                false,
                                                &mut any_delta,
                                            )
                                        {
                                            return Ok(usage);
                                        }
                                    }
                                }
                            }
                        } else if let Some(cv) = c {
                            if !Self::emit_stream_piece(
                                &mut emitted_content,
                                &mut on_delta,
                                cv,
                                false,
                                &mut any_delta,
                            ) {
                                return Ok(usage);
                            }
                        } else if let Some(rv) = r {
                            // Think off: still forward reasoning-only chunks as the answer stream
                            // (some servers only populate reasoning_content for certain templates).
                            if !Self::emit_stream_piece(
                                &mut emitted_content,
                                &mut on_delta,
                                rv,
                                false,
                                &mut any_delta,
                            ) {
                                return Ok(usage);
                            }
                        }
                    }
                }
            }
        }
        if !any_delta {
            if let Some(full) = last_msg_content {
                let cleaned = Self::strip_gemma_placeholder_tokens(&full);
                if !cleaned.is_empty() {
                    let _ = on_delta(&cleaned, false);
                }
            } else if let Some(full) = last_msg_reasoning {
                let cleaned = Self::strip_gemma_placeholder_tokens(&full);
                if !cleaned.is_empty() {
                    let _ = on_delta(&cleaned, include_reasoning_stream);
                }
            }
        }
        Ok(usage)
    }

    pub async fn list_models_openai(&self, base: &str) -> Result<serde_json::Value> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()?;
        let url = format!("{}/v1/models", base.trim_end_matches('/'));
        let res = client.get(&url).send().await?;
        Ok(res.json().await?)
    }

    pub async fn active_model_path(&self) -> Option<PathBuf> {
        let g = self.inner.lock().await;
        g.active_model.clone()
    }
}

#[cfg(test)]
mod stream_tests {
    use super::InferenceEngine;

    #[test]
    fn strip_gemma_placeholders() {
        assert_eq!(
            InferenceEngine::strip_gemma_placeholder_tokens("Hi <unused24> there"),
            "Hi  there"
        );
        assert_eq!(
            InferenceEngine::strip_gemma_placeholder_tokens("<unused49>"),
            ""
        );
    }
}
