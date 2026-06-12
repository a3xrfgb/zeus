//! Minimal GGUF header reader for `*.context_length` and `*.block_count` (layer count).
use crate::models::mmproj;
use std::fs::File;
use std::io::{self, Cursor, Read};
use std::path::Path;

#[derive(Debug, Clone, Default)]
pub struct GgufMeta {
    pub max_context_tokens: Option<u32>,
    pub layer_count: Option<u32>,
    pub embedding_length: Option<u32>,
}

/// GGUF types (ggml-org/llama.cpp gguf.h).
#[allow(dead_code)]
mod ty {
    pub const UINT8: u32 = 0;
    pub const INT8: u32 = 1;
    pub const UINT16: u32 = 2;
    pub const INT16: u32 = 3;
    pub const UINT32: u32 = 4;
    pub const INT32: u32 = 5;
    pub const FLOAT32: u32 = 6;
    pub const BOOL: u32 = 7;
    pub const STRING: u32 = 8;
    pub const ARRAY: u32 = 9;
    pub const UINT64: u32 = 10;
    pub const INT64: u32 = 11;
    pub const FLOAT64: u32 = 12;
}

fn read_u32(r: &mut Cursor<&[u8]>) -> io::Result<u32> {
    let mut b = [0u8; 4];
    r.read_exact(&mut b)?;
    Ok(u32::from_le_bytes(b))
}

fn read_u64(r: &mut Cursor<&[u8]>) -> io::Result<u64> {
    let mut b = [0u8; 8];
    r.read_exact(&mut b)?;
    Ok(u64::from_le_bytes(b))
}

fn read_string(r: &mut Cursor<&[u8]>) -> io::Result<String> {
    let len = read_u64(r)? as usize;
    let mut v = vec![0u8; len];
    r.read_exact(&mut v)?;
    String::from_utf8(v).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}

fn skip_value(r: &mut Cursor<&[u8]>, typ: u32) -> io::Result<()> {
    match typ {
        ty::UINT8 | ty::INT8 | ty::BOOL => {
            r.set_position(r.position() + 1);
        }
        ty::UINT16 | ty::INT16 => {
            r.set_position(r.position() + 2);
        }
        ty::UINT32 | ty::INT32 | ty::FLOAT32 => {
            r.set_position(r.position() + 4);
        }
        ty::UINT64 | ty::INT64 | ty::FLOAT64 => {
            r.set_position(r.position() + 8);
        }
        ty::STRING => {
            let _ = read_string(r)?;
        }
        ty::ARRAY => {
            let elem_type = read_u32(r)?;
            let count = read_u64(r)?;
            for _ in 0..count {
                skip_value(r, elem_type)?;
            }
        }
        _ => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("unsupported gguf value type {typ}")));
        }
    }
    Ok(())
}

/// Read up to `max_bytes` from the start of a GGUF file and extract common metadata keys.
pub fn read_gguf_meta(path: &Path, max_bytes: usize) -> GgufMeta {
    let Ok(mut f) = File::open(path) else {
        return GgufMeta::default();
    };
    let mut buf = vec![0u8; max_bytes];
    let Ok(n) = f.read(&mut buf) else {
        return GgufMeta::default();
    };
    if n < 24 {
        return GgufMeta::default();
    }
    buf.truncate(n);
    let mut cur = Cursor::new(buf.as_slice());
    let mut magic = [0u8; 4];
    if cur.read_exact(&mut magic).is_err() {
        return GgufMeta::default();
    }
    if &magic != b"GGUF" {
        return GgufMeta::default();
    }
    let Ok(_version) = read_u32(&mut cur) else {
        return GgufMeta::default();
    };
    let Ok(n_tensors) = read_u64(&mut cur) else {
        return GgufMeta::default();
    };
    let Ok(n_kv) = read_u64(&mut cur) else {
        return GgufMeta::default();
    };
    let mut meta = GgufMeta::default();

    for _ in 0..n_kv {
        let Ok(key) = read_string(&mut cur) else {
            return meta;
        };
        let Ok(typ) = read_u32(&mut cur) else {
            return meta;
        };
        let kl = key.to_ascii_lowercase();
        if typ == ty::UINT32 {
            let Ok(v) = read_u32(&mut cur) else {
                return meta;
            };
            if kl.ends_with("context_length") {
                meta.max_context_tokens = Some(v);
            } else if kl.ends_with("block_count") {
                meta.layer_count = Some(v);
            } else if kl.ends_with("embedding_length") {
                meta.embedding_length = Some(v);
            }
        } else if typ == ty::UINT64 && kl.ends_with("context_length") {
            let Ok(v) = read_u64(&mut cur) else {
                return meta;
            };
            if v > 0 && v <= u32::MAX as u64 {
                meta.max_context_tokens = Some(v as u32);
            }
        } else if skip_value(&mut cur, typ).is_err() {
            return meta;
        }
    }

    let _ = n_tensors;
    meta
}

const DEFAULT_CONTEXT_TOKENS: u32 = 8192;

/// Training / native context from GGUF (`*.context_length`).
pub fn native_context_tokens(path: &Path) -> u32 {
    let meta = read_gguf_meta(path, 16 * 1024 * 1024);
    meta.max_context_tokens
        .filter(|&n| n >= 256)
        .unwrap_or(DEFAULT_CONTEXT_TOKENS)
}

/// Back-compat alias for native GGUF context metadata.
pub fn resolve_context_tokens(path: &Path) -> u32 {
    native_context_tokens(path)
}

/// Context for llama-server `-c`: user setting capped by model native max (LM Studio style).
pub fn resolve_server_context_tokens(model_path: &Path, user_context_length: u32) -> u32 {
    let native = native_context_tokens(model_path);
    let user = user_context_length.max(256);
    user.min(native)
}

const MIN_COMPLETION_TOKENS: u32 = 512;
const PROMPT_TEMPLATE_OVERHEAD: u32 = 384;

fn content_char_len(v: &serde_json::Value) -> usize {
    match v {
        serde_json::Value::String(s) => s.len(),
        serde_json::Value::Array(parts) => parts.iter().map(content_char_len).sum(),
        serde_json::Value::Object(obj) => obj
            .get("text")
            .map(content_char_len)
            .unwrap_or(0)
            + obj.get("content").map(content_char_len).unwrap_or(0),
        _ => 0,
    }
}

/// Rough token count for an OpenAI-style messages array (conservative for chat templates).
pub fn estimate_tokens_from_messages(messages: &[serde_json::Value]) -> u32 {
    let chars: usize = messages
        .iter()
        .filter_map(|m| m.get("content"))
        .map(content_char_len)
        .sum();
    ((chars as u32).max(64) / 3).max(PROMPT_TEMPLATE_OVERHEAD)
}

/// Per-model cap so Gemma 4 / Qwen cannot burn 100k+ tokens on placeholders or thinking.
fn cap_completion_tokens(model_id: &str, computed: u32, think_enabled: bool) -> u32 {
    if mmproj::looks_like_gemma_4_model_id(model_id) {
        // Gemma 4 can loop on `<unusedN>` placeholders when the budget is huge (see llama.cpp#21321).
        return computed.min(if think_enabled { 8192 } else { 4096 });
    }
    let id = model_id.to_ascii_lowercase();
    if id.contains("qwen3") || id.contains("qwen3.5") {
        return computed.min(if think_enabled { 16384 } else { 8192 });
    }
    computed.min(32768)
}

/// Max completion tokens for one chat turn: server context minus estimated prompt size.
pub fn resolve_chat_max_tokens(
    model_path: &Path,
    messages: &[serde_json::Value],
    server_ctx: u32,
    model_id: &str,
    think_enabled: bool,
) -> u32 {
    let ctx = resolve_server_context_tokens(model_path, server_ctx);
    let prompt_est = estimate_tokens_from_messages(messages);
    let reserved = prompt_est.saturating_add(PROMPT_TEMPLATE_OVERHEAD);
    let computed = if reserved + MIN_COMPLETION_TOKENS >= ctx {
        MIN_COMPLETION_TOKENS
    } else {
        ctx - reserved
    };
    cap_completion_tokens(model_id, computed, think_enabled)
}

/// True if the first `max_bytes` of the file contain `needle` (ASCII).
/// Used to detect Prism ML `Q1_0_g128` GGUFs that require their llama.cpp fork.
pub fn gguf_file_contains(path: &Path, needle: &[u8], max_bytes: usize) -> bool {
    if needle.is_empty() {
        return true;
    }
    let Ok(mut f) = File::open(path) else {
        return false;
    };
    let mut buf = vec![0u8; max_bytes];
    let Ok(n) = f.read(&mut buf) else {
        return false;
    };
    if n < needle.len() {
        return false;
    }
    buf.truncate(n);
    buf.windows(needle.len()).any(|w| w == needle)
}
