//! Download `llama-server` and companion DLLs from [ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp)
//! releases into `~/.zeus/llama-cpp/` (always resolved via GitHub `releases/latest`).
//!
//! Official Windows CUDA 12 bundle (per release tag, e.g. b9585):
//! - Engine: `llama-<tag>-bin-win-cuda-12.4-x64.zip`
//! - Runtime DLLs: `cudart-llama-bin-win-cuda-12.4-x64.zip`
const RUNTIME_VARIANT_CUDA: &str = "cuda12";
use futures_util::StreamExt;
use serde::Deserialize;
use serde_json::json;
use std::fs::{self, File};
use std::io::{Read, Seek};
use std::path::{Path, PathBuf};
use std::time::Duration;
use crate::inference::llama_binary::{
    zeus_llama_cpp_dir, cuda_runtime_dlls_present, detect_llama_backend,
    is_llama_runtime_artifact, llama_server_exe_name, migrate_legacy_athena_llama_cpp,
    migrate_legacy_bin_to_llama_cpp,
    missing_cuda_runtime_dlls, resolve_llama_server_binary, GITHUB_RELEASES_LATEST,
};
use crate::sidecar::context::{AppContext, EventBus};
use tokio::io::AsyncWriteExt;

const VERSION_SIDECAR: &str = "llama-server.version";

#[derive(Deserialize, Clone)]
struct GhRelease {
    tag_name: String,
    assets: Vec<GhAsset>,
}

#[derive(Deserialize, Clone)]
struct GhAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

fn version_file_path() -> Option<PathBuf> {
    zeus_llama_cpp_dir().map(|d| d.join(VERSION_SIDECAR))
}

fn read_installed_tag() -> Option<String> {
    let p = version_file_path()?;
    fs::read_to_string(&p)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Strict match for the **main** engine zip (not cudart-only).
fn pick_main_engine_asset(assets: &[GhAsset], variant: &str) -> Option<usize> {
    let v = variant.to_lowercase();
    for (i, a) in assets.iter().enumerate() {
        let n = a.name.to_lowercase();
        if !n.ends_with(".zip") || !n.starts_with("llama-") {
            continue;
        }
        let ok = match v.as_str() {
            "cpu" => n.contains("bin-win-cpu-x64") && !n.contains("arm64"),
            "vulkan" => n.contains("bin-win-vulkan-x64"),
            // Prefer exact 12.4 x64 bundle (same as upstream release layout).
            "cuda12" => n.contains("bin-win-cuda-12.4-x64"),
            _ => false,
        };
        if !ok {
            continue;
        }
        return Some(i);
    }
    // Fallback for cuda12: any llama `bin-win-cuda-12` that is not 13.x
    if v == "cuda12" {
        for (i, a) in assets.iter().enumerate() {
            let n = a.name.to_lowercase();
            if !n.ends_with(".zip") || !n.starts_with("llama-") {
                continue;
            }
            if n.contains("bin-win-cuda-12")
                && !n.contains("cuda-13")
                && !n.contains("13.1")
            {
                return Some(i);
            }
        }
    }
    None
}

/// `cudart-llama-bin-win-cuda-12.4-x64.zip` — CUDA runtime DLLs only.
fn pick_cudart_12_asset(assets: &[GhAsset]) -> Option<usize> {
    for (i, a) in assets.iter().enumerate() {
        let n = a.name.to_lowercase();
        if !n.ends_with(".zip") {
            continue;
        }
        if n.starts_with("cudart-") && n.contains("bin-win-cuda-12.4-x64") {
            return Some(i);
        }
    }
    // looser: cudart + cuda-12 + win, not 13
    for (i, a) in assets.iter().enumerate() {
        let n = a.name.to_lowercase();
        if n.starts_with("cudart-")
            && n.contains("bin-win")
            && n.contains("cuda-12")
            && !n.contains("cuda-13")
        {
            return Some(i);
        }
    }
    None
}

/// Extract entire zip into `dest_dir` (safe paths via `enclosed_name`).
fn extract_zip_all_to_dir<R: Read + Seek>(archive: &mut zip::ZipArchive<R>, dest_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(dest_dir).map_err(|e| e.to_string())?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.name();
        if name.ends_with('/') {
            continue;
        }
        let rel = match file.enclosed_name() {
            Some(p) => p,
            None => continue,
        };
        let outpath = dest_dir.join(rel);
        if let Some(parent) = outpath.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
        std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn verify_llama_server_present(dest_dir: &Path) -> Result<(), String> {
    let exe = dest_dir.join(llama_server_exe_name());
    if exe.exists() {
        Ok(())
    } else {
        Err(format!(
            "{} not found after extraction. Check the release zip layout.",
            llama_server_exe_name()
        ))
    }
}

/// CUDA 12 engine zip must ship `ggml-cuda.dll` beside `llama-server` (e.g. `llama-b9585-bin-win-cuda-12.4-x64.zip`).
fn verify_cuda_backend_present(dest_dir: &Path) -> Result<(), String> {
    let cuda_dll = dest_dir.join("ggml-cuda.dll");
    if cuda_dll.is_file() {
        Ok(())
    } else {
        Err(
            "ggml-cuda.dll not found after CUDA 12 extraction. The main engine zip (llama-<tag>-bin-win-cuda-12.4-x64.zip) was missing or incomplete — do not use the cudart-only zip alone.".into(),
        )
    }
}

/// `cudart-llama-bin-win-cuda-12.4-x64.zip` must ship NVIDIA runtime DLLs beside `llama-server`.
fn verify_cudart_dlls_present(dest_dir: &Path) -> Result<(), String> {
    if cuda_runtime_dlls_present(dest_dir) {
        Ok(())
    } else {
        let missing = missing_cuda_runtime_dlls(dest_dir).join(", ");
        Err(format!(
            "CUDA runtime DLLs missing after extraction ({missing}). \
             CUDA 12 needs both zips: llama-<tag>-bin-win-cuda-12.4-x64.zip (engine + ggml-cuda.dll) \
             and cudart-llama-bin-win-cuda-12.4-x64.zip (cudart64_12.dll, cublas64_12.dll, cublaslt64_12.dll)."
        ))
    }
}

fn installed_cudart_missing() -> bool {
    let Some(dir) = zeus_llama_cpp_dir() else {
        return false;
    };
    if !dir.join(llama_server_exe_name()).is_file() {
        return false;
    }
    detect_llama_backend(&dir) == "cuda" && !cuda_runtime_dlls_present(&dir)
}

fn http_client_ua() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(concat!(
            "Zeus/",
            env!("CARGO_PKG_VERSION"),
            " (https://github.com/ggml-org/llama.cpp; llama-server installer)"
        ))
        .redirect(reqwest::redirect::Policy::limited(16))
        .build()
        .expect("reqwest client")
}

fn with_github_token(req: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
    match std::env::var("GITHUB_TOKEN") {
        Ok(tok) if !tok.is_empty() => req.header("Authorization", format!("Bearer {tok}")),
        _ => req,
    }
}

async fn http_error_body(res: reqwest::Response) -> String {
    let status = res.status();
    let bytes = res.bytes().await.unwrap_or_default();
    let snippet = String::from_utf8_lossy(&bytes[..bytes.len().min(512)]);
    format!("HTTP {status} — {snippet}")
}

async fn fetch_latest_release() -> Result<GhRelease, String> {
    let client = http_client_ua();
    let res = with_github_token(
        client
            .get(GITHUB_RELEASES_LATEST)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28"))
    .timeout(Duration::from_secs(45))
    .send()
    .await
    .map_err(|e| format!("GitHub API request failed: {e}"))?;
    if !res.status().is_success() {
        return Err(format!(
            "GitHub API error: {}",
            http_error_body(res).await
        ));
    }
    res.json::<GhRelease>()
        .await
        .map_err(|e| format!("GitHub API JSON: {e}"))
}

#[cfg(target_os = "windows")]
async fn download_zip_to_path_emit(
    events: &EventBus,
    client: &reqwest::Client,
    asset: &GhAsset,
    tmp_path: &Path,
    downloaded_global: &mut u64,
    total_plan: u64) -> Result<(), String> {
    let res = client
        .get(&asset.browser_download_url)
        .header("Accept", "application/octet-stream")
        .timeout(Duration::from_secs(900))
        .send()
        .await
        .map_err(|e| format!("Download {} failed: {e}", asset.name))?;
    if !res.status().is_success() {
        return Err(format!(
            "Download {}: {}",
            asset.name,
            http_error_body(res).await
        ));
    }
    let mut stream = res.bytes_stream();
    let mut file = tokio::fs::File::create(tmp_path)
        .await
        .map_err(|e| format!("temp file {}: {e}", tmp_path.display()))?;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk)
            .await
            .map_err(|e| e.to_string())?;
        *downloaded_global += chunk.len() as u64;
        let pct = if total_plan > 0 {
            (*downloaded_global as f64 / total_plan as f64) * 100.0
        } else {
            0.0
        };
        let _ = events.emit(
            "zeus-runtime-download",
            json!({
                "bytesDownloaded": *downloaded_global,
                "totalBytes": total_plan,
                "percentage": pct.min(99.9),
                "status": "downloading",
                "phase": asset.name,
            }));
    }
    file.flush().await.map_err(|e| e.to_string())?;
    Ok(())
}

fn installed_llama_backend() -> Option<&'static str> {
    let dir = zeus_llama_cpp_dir()?;
    if !dir.join(llama_server_exe_name()).is_file() {
        return None;
    }
    Some(detect_llama_backend(&dir))
}

fn cuda_backend_mismatch(installed_backend: Option<&str>) -> bool {
    matches!(installed_backend, Some(installed) if installed != "cuda")
}

/// Latest release info + matched main/cudart assets (Windows).
pub async fn get_llama_runtime_info(_ctx: &AppContext, _variant: String) -> Result<serde_json::Value, String> {
    migrate_legacy_bin_to_llama_cpp();
    migrate_legacy_athena_llama_cpp();
    let rel = fetch_latest_release().await?;
    let installed = read_installed_tag();
    let llama_server_path = resolve_llama_server_binary()
        .map(|p| p.to_string_lossy().to_string());
    let installed_backend = installed_llama_backend().map(str::to_string);
    let backend_mismatch = cuda_backend_mismatch(installed_llama_backend());
    let cudart_missing = installed_cudart_missing();
    let missing_cudart_dlls: Vec<&str> = zeus_llama_cpp_dir()
        .map(|d| missing_cuda_runtime_dlls(&d))
        .unwrap_or_default();
    #[cfg(target_os = "windows")]
    {
        let main_idx = pick_main_engine_asset(&rel.assets, RUNTIME_VARIANT_CUDA);
        let main = main_idx.and_then(|i| rel.assets.get(i));
        let cudart_idx = pick_cudart_12_asset(&rel.assets);
        let cudart = cudart_idx.and_then(|i| rel.assets.get(i));
        let llama_missing = llama_server_path.is_none();
        let update_available = match (&installed, &rel.tag_name) {
            (Some(ins), latest) => ins != latest,
            (None, _) => true,
        };
        return Ok(json!({
            "latestTag": rel.tag_name,
            "installedTag": installed,
            "updateAvailable": update_available || backend_mismatch || llama_missing || cudart_missing,
            "assetName": main.map(|a| a.name.clone()),
            "assetUrl": main.map(|a| a.browser_download_url.clone()),
            "assetSize": main.map(|a| a.size),
            "cudartAssetName": cudart.map(|a| a.name.clone()),
            "cudartUrl": cudart.map(|a| a.browser_download_url.clone()),
            "cudartSize": cudart.map(|a| a.size),
            "binDir": zeus_llama_cpp_dir().map(|p| p.to_string_lossy().to_string()),
            "llamaCppDir": zeus_llama_cpp_dir().map(|p| p.to_string_lossy().to_string()),
            "llamaServerPath": llama_server_path,
            "installedBackend": installed_backend,
            "backendMismatch": backend_mismatch,
            "cudartMissing": cudart_missing,
            "missingCudartDlls": missing_cudart_dlls,
            "supported": true,
        }));
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(json!({
            "latestTag": rel.tag_name,
            "installedTag": installed,
            "updateAvailable": true,
            "assetName": serde_json::Value::Null,
            "assetUrl": serde_json::Value::Null,
            "assetSize": serde_json::Value::Null,
            "cudartAssetName": serde_json::Value::Null,
            "cudartUrl": serde_json::Value::Null,
            "cudartSize": serde_json::Value::Null,
            "binDir": zeus_llama_cpp_dir().map(|p| p.to_string_lossy().to_string()),
            "llamaCppDir": zeus_llama_cpp_dir().map(|p| p.to_string_lossy().to_string()),
            "llamaServerPath": llama_server_path,
            "installedBackend": installed_backend,
            "backendMismatch": false,
            "cudartMissing": cudart_missing,
            "missingCudartDlls": missing_cudart_dlls,
            "supported": false,
        }))
    }
}

/// Download only the CUDA runtime DLL zip (cudart) into `~/.zeus/llama-cpp/`.
pub async fn download_cudart_runtime(ctx: &AppContext) -> Result<(), String> {
    #[cfg(not(target_os = "windows"))]
    {
        let _ = ctx;
        return Err("cudart download is Windows-only.".into());
    }
    #[cfg(target_os = "windows")]
    {
        let rel = fetch_latest_release().await?;
        let idx = pick_cudart_12_asset(&rel.assets)
            .ok_or_else(|| "No cudart zip (cuda-12.4 x64) in this release.".to_string())?;
        let asset = rel.assets.get(idx).ok_or_else(|| "asset".to_string())?;
        let llama_dir = zeus_llama_cpp_dir().ok_or_else(|| "no Zeus data dir".to_string())?;
        fs::create_dir_all(&llama_dir).map_err(|e| e.to_string())?;
        let total_plan = asset.size.max(1);
        let mut downloaded_global: u64 = 0;
        let tmp_path = std::env::temp_dir().join(format!(
            "zeus-cudart-{}.zip",
            uuid::Uuid::new_v4()
        ));
        let client = http_client_ua();
        download_zip_to_path_emit(
            &ctx.events,
            &client,
            asset,
            &tmp_path,
            &mut downloaded_global,
            total_plan)
        .await?;
        let f = File::open(&tmp_path).map_err(|e| e.to_string())?;
        let mut archive = zip::ZipArchive::new(f).map_err(|e| format!("open zip: {e}"))?;
        extract_zip_all_to_dir(&mut archive, &llama_dir)?;
        verify_cudart_dlls_present(&llama_dir)?;
        let _ = fs::remove_file(&tmp_path);
        let _ = ctx.events.emit(
            "zeus-runtime-download",
            json!({
                "bytesDownloaded": downloaded_global,
                "totalBytes": total_plan,
                "percentage": 100.0,
                "status": "complete",
                "phase": "cudart",
            }));
        Ok(())
    }
}

/// Download selected variant: full extract to bin. CUDA 12 downloads **cudart first**, then main engine zip.
pub async fn download_llama_runtime(ctx: &AppContext, _variant: String) -> Result<(), String> {
    #[cfg(not(target_os = "windows"))]
    {
        let _ = ctx;
        return Err("Automated llama-server download is only implemented for Windows in this build.".into());
    }

    #[cfg(target_os = "windows")]
    {
        let rel = fetch_latest_release().await?;
        let main_idx = pick_main_engine_asset(&rel.assets, RUNTIME_VARIANT_CUDA).ok_or_else(|| {
            "No matching CUDA 12 bundle in this release. Expected llama-<tag>-bin-win-cuda-12.4-x64.zip.".to_string()
        })?;
        let main_asset = rel.assets.get(main_idx).ok_or_else(|| "main asset".to_string())?;

        let cudart_idx = pick_cudart_12_asset(&rel.assets).ok_or_else(|| {
            "Release is missing cudart-llama-bin-win-cuda-12.4-x64.zip; CUDA 12 needs both cudart and the main llama CUDA bundle.".to_string()
        })?;
        let cudart_asset = Some(rel.assets.get(cudart_idx).ok_or_else(|| "cudart asset".to_string())?);

        let llama_dir = zeus_llama_cpp_dir().ok_or_else(|| "no Zeus data dir".to_string())?;
        fs::create_dir_all(&llama_dir).map_err(|e| e.to_string())?;

        let total_plan = match cudart_asset {
            Some(c) => c.size.saturating_add(main_asset.size).max(1),
            None => main_asset.size.max(1),
        };
        let mut downloaded_global: u64 = 0;
        let client = http_client_ua();

        if let Some(cuda_rt) = cudart_asset {
            let tmp_cudart = std::env::temp_dir().join(format!(
                "zeus-cudart-{}.zip",
                uuid::Uuid::new_v4()
            ));
            download_zip_to_path_emit(
                &ctx.events,
                &client,
                cuda_rt,
                &tmp_cudart,
                &mut downloaded_global,
                total_plan)
            .await?;
            let f = File::open(&tmp_cudart).map_err(|e| e.to_string())?;
            let mut archive = zip::ZipArchive::new(f).map_err(|e| format!("cudart zip: {e}"))?;
            extract_zip_all_to_dir(&mut archive, &llama_dir)?;
            verify_cudart_dlls_present(&llama_dir)?;
            let _ = fs::remove_file(&tmp_cudart);
        }

        let tmp_main = std::env::temp_dir().join(format!(
            "zeus-llama-runtime-{}.zip",
            uuid::Uuid::new_v4()
        ));
        download_zip_to_path_emit(
            &ctx.events,
            &client,
            main_asset,
            &tmp_main,
            &mut downloaded_global,
            total_plan)
        .await?;

        let f = File::open(&tmp_main).map_err(|e| e.to_string())?;
        let mut archive = zip::ZipArchive::new(f).map_err(|e| format!("main zip: {e}"))?;
        extract_zip_all_to_dir(&mut archive, &llama_dir)?;
        let _ = fs::remove_file(&tmp_main);

        verify_llama_server_present(&llama_dir)?;
        verify_cuda_backend_present(&llama_dir)?;
        verify_cudart_dlls_present(&llama_dir)?;

        let vf = llama_dir.join(VERSION_SIDECAR);
        fs::write(&vf, rel.tag_name.as_bytes()).map_err(|e| e.to_string())?;

        let _ = ctx.events.emit(
            "zeus-runtime-download",
            json!({
                "bytesDownloaded": downloaded_global,
                "totalBytes": total_plan,
                "percentage": 100.0,
                "status": "complete",
                "phase": "done",
            }));

        let _ = ctx.inference.0.stop_llama_server().await;

        Ok(())
    }
}

/// Stop `llama-server` and delete llama.cpp runtime files from `~/.zeus/llama-cpp`.
pub async fn remove_llama_runtime(ctx: &AppContext) -> Result<serde_json::Value, String> {
    let _ = ctx.inference.0.stop_llama_server().await;
    let Some(llama_dir) = zeus_llama_cpp_dir() else {
        return Ok(json!({ "removed": 0, "bytesFreed": 0 }));
    };
    if !llama_dir.is_dir() {
        return Ok(json!({ "removed": 0, "bytesFreed": 0 }));
    }

    let mut removed = 0u32;
    let mut bytes_freed = 0u64;
    for entry in fs::read_dir(&llama_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|s| s.to_str()) else {
            continue;
        };
        if !is_llama_runtime_artifact(name) {
            continue;
        }
        let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        fs::remove_file(&path).map_err(|e| format!("remove {}: {e}", path.display()))?;
        removed += 1;
        bytes_freed = bytes_freed.saturating_add(size);
    }

    Ok(json!({
        "removed": removed,
        "bytesFreed": bytes_freed,
        "binDir": llama_dir.to_string_lossy(),
        "llamaCppDir": llama_dir.to_string_lossy(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn a(name: &str, size: u64) -> GhAsset {
        GhAsset {
            name: name.into(),
            browser_download_url: format!("https://example.com/{name}"),
            size,
        }
    }

    #[test]
    fn picks_exact_cpu_vulkan_cuda_cudart() {
        let assets = vec![
            a("cudart-llama-bin-win-cuda-12.4-x64.zip", 1),
            a("cudart-llama-bin-win-cuda-13.1-x64.zip", 1),
            a("llama-b8665-bin-win-cpu-arm64.zip", 1),
            a("llama-b8665-bin-win-cpu-x64.zip", 100),
            a("llama-b8665-bin-win-vulkan-x64.zip", 200),
            a("llama-b8665-bin-win-cuda-12.4-x64.zip", 300),
            a("llama-b8665-bin-win-cuda-13.1-x64.zip", 400),
        ];
        assert_eq!(
            pick_main_engine_asset(&assets, "cpu").map(|i| assets[i].name.as_str()),
            Some("llama-b8665-bin-win-cpu-x64.zip")
        );
        assert_eq!(
            pick_main_engine_asset(&assets, "vulkan").map(|i| assets[i].name.as_str()),
            Some("llama-b8665-bin-win-vulkan-x64.zip")
        );
        assert_eq!(
            pick_main_engine_asset(&assets, "cuda12").map(|i| assets[i].name.as_str()),
            Some("llama-b8665-bin-win-cuda-12.4-x64.zip")
        );
        assert_eq!(
            pick_cudart_12_asset(&assets).map(|i| assets[i].name.as_str()),
            Some("cudart-llama-bin-win-cuda-12.4-x64.zip")
        );
    }

    #[test]
    fn llama_artifact_matcher_skips_stable_diffusion() {
        assert!(is_llama_runtime_artifact("llama-server.exe"));
        assert!(is_llama_runtime_artifact("ggml-cuda.dll"));
        assert!(is_llama_runtime_artifact("cudart64_12.dll"));
        assert!(!is_llama_runtime_artifact("sd-cli.exe"));
        assert!(!is_llama_runtime_artifact("stable-diffusion.dll"));
    }

    #[test]
    fn cuda_runtime_dlls_all_required() {
        use crate::inference::llama_binary::{cuda_runtime_dlls_present, CUDA_RUNTIME_DLLS};
        let dir = std::env::temp_dir().join(format!("zeus-cudart-test-{}", uuid::Uuid::new_v4()));
        let _ = fs::create_dir_all(&dir);
        assert!(!cuda_runtime_dlls_present(&dir));
        for dll in CUDA_RUNTIME_DLLS {
            let _ = fs::write(dir.join(dll), b"x");
        }
        assert!(cuda_runtime_dlls_present(&dir));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn cuda12_resolves_b9585_github_asset_url() {
        let name = "llama-b9585-bin-win-cuda-12.4-x64.zip";
        let assets = vec![a(
            name,
            260_940_464,
        )];
        let idx = pick_main_engine_asset(&assets, "cuda12").unwrap();
        assert_eq!(assets[idx].name, name);
        assert_eq!(
            assets[idx].browser_download_url,
            "https://example.com/llama-b9585-bin-win-cuda-12.4-x64.zip"
        );
    }
}
