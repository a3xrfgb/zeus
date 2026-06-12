use crate::models::gguf_meta;
use crate::types::ModelInfo;
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

fn guess_params(name: &str) -> String {
    let lower = name.to_lowercase();
    for pat in ["70b", "34b", "32b", "14b", "13b", "12b", "9b", "8b", "7b", "3b", "2b", "1b"] {
        if lower.contains(pat) {
            return pat.to_uppercase().replace('B', "B");
        }
    }
    "—".into()
}

/// Legacy GPT-OSS weights are no longer supported in Zeus — hide from scans and UI.
fn is_legacy_gpt_oss_excluded(id: &str) -> bool {
    let norm: String = id
        .to_lowercase()
        .chars()
        .map(|c| match c {
            '.' | '-' => '_',
            c => c,
        })
        .collect();
    norm.contains("gpt_oss")
}

fn guess_quant(name: &str) -> String {
    let upper = name.to_uppercase();
    for q in [
        "Q8_0", "Q6_K", "Q5_K_M", "Q5_K_S", "Q5_0", "Q4_K_M", "Q4_K_S", "Q4_0", "Q3_K_M",
        "Q3_K_S", "Q2_K", "IQ4_NL", "F16", "F32", "BF16",
    ] {
        if upper.contains(q) {
            return q.into();
        }
    }
    "GGUF".into()
}

const QUANT_SUFFIXES: &[&str] = &[
    "Q8_0", "Q6_K", "Q5_K_M", "Q5_K_S", "Q5_0", "Q4_K_M", "Q4_K_S", "Q4_0", "Q3_K_M", "Q3_K_S",
    "Q2_K", "IQ4_NL", "BF16", "F16", "F32",
];

fn normalize_model_stem(s: &str) -> String {
    s.to_lowercase().replace('.', "_").replace('-', "_")
}

fn strip_quant_suffix(stem: &str) -> String {
    let upper = stem.to_uppercase();
    for q in QUANT_SUFFIXES {
        for sep in ['-', '_'] {
            let suffix = format!("{sep}{q}");
            if upper.ends_with(&suffix) {
                let cut = stem.len().saturating_sub(suffix.len());
                return stem[..cut].to_string();
            }
        }
    }
    stem.to_string()
}

fn model_family_stem(stem: &str) -> String {
    normalize_model_stem(&strip_quant_suffix(stem))
}

pub fn model_ids_same_family(stem: &str, model_id: &str) -> bool {
    if model_id_fs_variants(model_id)
        .iter()
        .any(|v| v.as_str() == stem)
    {
        return true;
    }
    model_family_stem(stem) == model_family_stem(model_id)
}

/// Dotted vs underscored stems (legacy bundles saved when `.` was stripped from filenames).
/// Hyphens become underscores so catalog ids match on-disk GGUF names.
pub fn model_id_fs_variants(model_id: &str) -> Vec<String> {
    let mut out = Vec::new();
    let all_underscore = model_id.replace(['.', '-'], "_");
    for cand in [model_id.to_string(), all_underscore] {
        if !out.iter().any(|s| s == &cand) {
            out.push(cand);
        }
    }
    out
}

fn file_stem_matches_model_id(stem: &str, model_id: &str) -> bool {
    model_ids_same_family(stem, model_id)
}

/// Working substitute when stock Gemma 4 E4B IT GGUF only emits `<unusedN>` placeholders.
#[allow(dead_code)]
pub const GEMMA_UNCENSORED_FALLBACK: &str = "gemma-4-E4B-it-ultra-uncensored-heretic-Q4_K_M";

/// Returns the requested chat model id (no silent substitution).
pub fn resolve_working_chat_model_id(_data_dir: &str, model_id: &str) -> String {
    model_id.to_string()
}

fn canonical_path(p: &Path) -> PathBuf {
    p.canonicalize().unwrap_or_else(|_| p.to_path_buf())
}

/// Primary `data/models` plus legacy `~/.athena/models` when Zeus data lives under `~/.zeus`.
pub fn model_search_dirs(data_dir: &Path) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(primary) = ensure_models_dir(data_dir) {
        dirs.push(primary);
    }
    if let Some(home) = dirs::home_dir() {
        let legacy = home.join(".athena").join("models");
        if legacy.is_dir() {
            let legacy_key = canonical_path(&legacy);
            let already = dirs
                .iter()
                .any(|d| canonical_path(d) == legacy_key);
            if !already {
                dirs.push(legacy);
            }
        }
    }
    dirs
}

fn resolve_gguf_path_in_dir(models_dir: &Path, model_id: &str) -> Option<PathBuf> {
    for stem in model_id_fs_variants(model_id) {
        let flat = models_dir.join(format!("{stem}.gguf"));
        if flat.is_file() {
            return Some(flat);
        }
    }
    if let Ok(rd) = fs::read_dir(models_dir) {
        for e in rd.flatten() {
            let p = e.path();
            if !p.is_dir() {
                continue;
            }
            for stem in model_id_fs_variants(model_id) {
                let cand = p.join(format!("{stem}.gguf"));
                if cand.is_file() {
                    return Some(cand);
                }
            }
            if let Ok(rd2) = fs::read_dir(&p) {
                for f in rd2.flatten() {
                    let fp = f.path();
                    if !fp.extension().map(|x| x == "gguf").unwrap_or(false) {
                        continue;
                    }
                    let Some(stem) = fp.file_stem().and_then(|s| s.to_str()) else {
                        continue;
                    };
                    if stem.starts_with("mmproj-") {
                        continue;
                    }
                    if model_ids_same_family(stem, model_id) {
                        return Some(fp);
                    }
                }
            }
        }
    }
    None
}

/// `models/<id>.gguf` or any `models/<bundleDir>/<id>.gguf` (catalog bundle folders).
pub fn resolve_gguf_path(models_dir: &Path, model_id: &str) -> Option<PathBuf> {
    let data_dir = models_dir.parent().unwrap_or(models_dir);
    for dir in model_search_dirs(data_dir) {
        if let Some(path) = resolve_gguf_path_in_dir(&dir, model_id) {
            return Some(path);
        }
    }
    None
}

fn collect_gguf_paths(models_dir: &Path, out: &mut Vec<PathBuf>) -> Result<()> {
    if !models_dir.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(models_dir).with_context(|| format!("read_dir {:?}", models_dir))? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            for e2 in fs::read_dir(&path).with_context(|| format!("read_dir {:?}", path))? {
                let e2 = e2?;
                let p2 = e2.path();
                if p2.extension().map(|e| e == "gguf").unwrap_or(false) {
                    out.push(p2);
                }
            }
        } else if path.extension().map(|e| e == "gguf").unwrap_or(false) {
            out.push(path);
        }
    }
    Ok(())
}

pub fn scan_models(models_dir: &Path, active_path: Option<&str>) -> Result<Vec<ModelInfo>> {
    if !models_dir.exists() {
        fs::create_dir_all(models_dir).with_context(|| format!("mkdir {:?}", models_dir))?;
    }
    let data_dir = models_dir.parent().unwrap_or(models_dir);
    let mut paths: Vec<PathBuf> = Vec::new();
    for dir in model_search_dirs(data_dir) {
        collect_gguf_paths(&dir, &mut paths)?;
    }
    paths.sort_by(|a, b| {
        a.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .cmp(b.file_name().and_then(|n| n.to_str()).unwrap_or(""))
    });

    let mut by_id: HashMap<String, PathBuf> = HashMap::new();
    for path in paths {
        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("model.gguf")
            .to_string();
        let id = filename.trim_end_matches(".gguf").to_string();
        if is_legacy_gpt_oss_excluded(&id) {
            continue;
        }
        let in_primary = path.starts_with(models_dir);
        let replace = match by_id.get(&id) {
            None => true,
            Some(existing) => in_primary && !existing.starts_with(models_dir),
        };
        if replace {
            by_id.insert(id, path);
        }
    }

    let mut out = Vec::new();
    for (id, path) in by_id {
        let Ok(meta) = fs::metadata(&path) else {
            continue;
        };
        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("model.gguf")
            .to_string();
        let name = id.clone();
        let local_path = path.to_string_lossy().to_string();
        let is_loaded = active_path.map(|a| a == local_path.as_str()).unwrap_or(false);
        let params = guess_params(&filename);
        let quant = guess_quant(&filename);
        let gm = gguf_meta::read_gguf_meta(&path, 16 * 1024 * 1024);
        out.push(ModelInfo {
            id: id.clone(),
            name,
            filename,
            size_bytes: meta.len(),
            parameters: params,
            quantization: quant,
            format: "GGUF".into(),
            local_path,
            is_loaded,
            max_context_tokens: gm.max_context_tokens,
            layer_count: gm.layer_count,
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

pub fn ensure_models_dir(base: &Path) -> Result<PathBuf> {
    let p = base.join("models");
    if !p.exists() {
        fs::create_dir_all(&p)?;
    }
    Ok(p)
}

/// Resolve an on-disk bundle folder under `models/`, trying the canonical name, aliases,
/// then any subdirectory that contains all `marker_files`.
pub fn resolve_bundle_subdir(
    models_dir: &Path,
    canonical: &str,
    aliases: &[&str],
    marker_files: &[&str],
) -> PathBuf {
    let has_markers = |p: &Path| marker_files.iter().all(|m| p.join(m).is_file());

    for name in std::iter::once(canonical).chain(aliases.iter().copied()) {
        let p = models_dir.join(name);
        if p.is_dir() && (marker_files.is_empty() || has_markers(&p)) {
            return p;
        }
    }
    if !marker_files.is_empty() {
        if let Ok(rd) = fs::read_dir(models_dir) {
            for e in rd.flatten() {
                let p = e.path();
                if p.is_dir() && has_markers(&p) {
                    return p;
                }
            }
        }
    }
    models_dir.join(canonical)
}

/// Removes a GGUF. Deleting **main** weights inside a bundle subfolder drops the whole folder (main + mmproj).
pub fn delete_model_artifacts(models_dir: &Path, model_id: &str) -> Result<()> {
    let Some(path) = resolve_gguf_path(models_dir, model_id) else {
        return Ok(());
    };
    if let Some(parent) = path.parent() {
        if parent != models_dir {
            let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
            if file_stem_matches_model_id(stem, model_id) && !model_id.starts_with("mmproj-") {
                return fs::remove_dir_all(parent).with_context(|| format!("remove_dir {:?}", parent));
            }
        }
    }
    fs::remove_file(&path).with_context(|| format!("remove {:?}", path))?;
    Ok(())
}
