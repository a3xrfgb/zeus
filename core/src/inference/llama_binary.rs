use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

/// Subfolder under the Zeus data root for managed llama.cpp binaries.
pub const LLAMA_CPP_DIR_NAME: &str = "llama-cpp";

pub const GITHUB_RELEASES_LATEST: &str =
    "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest";

/// `~/.zeus` (or `ZEUS_DATA_DIR` when set by the Electron sidecar).
pub fn zeus_data_root() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("ZEUS_DATA_DIR") {
        let t = p.trim();
        if !t.is_empty() {
            return Some(PathBuf::from(t));
        }
    }
    if let Some(home) = dirs::home_dir() {
        let legacy = home.join(".athena");
        let modern = home.join(".zeus");
        if legacy.is_dir() && !modern.exists() {
            let _ = std::fs::rename(&legacy, &modern);
        }
        return Some(modern);
    }
    None
}

/// `~/.zeus/llama-cpp` — official Zeus llama.cpp install location.
pub fn zeus_llama_cpp_dir() -> Option<PathBuf> {
    zeus_data_root().map(|r| r.join(LLAMA_CPP_DIR_NAME))
}

/// Legacy path before llama-cpp folder; kept for one-time migration only.
fn legacy_zeus_bin_dir() -> Option<PathBuf> {
    zeus_data_root().map(|r| r.join("bin"))
}

/// Pre-rename Athena home (`~/.athena/llama-cpp`) when both `.athena` and `.zeus` exist.
fn legacy_athena_llama_cpp_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".athena").join(LLAMA_CPP_DIR_NAME))
}

pub fn llama_server_exe_name() -> &'static str {
    if cfg!(windows) {
        "llama-server.exe"
    } else {
        "llama-server"
    }
}

/// Whether `name` belongs to a llama.cpp CUDA/CPU release bundle.
pub fn is_llama_runtime_artifact(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    if n.starts_with("sd-") || n.starts_with("stable-diffusion") {
        return false;
    }
    if matches!(
        n.as_str(),
        "llama-server" | "llama-server.exe" | "llama-server.version" | "llama.dll"
    ) {
        return true;
    }
    if n.starts_with("llama-") || n.starts_with("ggml") {
        return true;
    }
    if matches!(
        n.as_str(),
        "mtmd.dll" | "rpc-server.exe" | "libomp140.x86_64.dll" | "ggml.txt"
    ) {
        return true;
    }
    matches!(
        n.as_str(),
        "cudart64_12.dll" | "cublas64_12.dll" | "cublaslt64_12.dll"
    )
}

/// NVIDIA CUDA 12 runtime DLLs from `cudart-llama-bin-win-cuda-12.4-x64.zip`.
pub const CUDA_RUNTIME_DLLS: &[&str] = &[
    "cudart64_12.dll",
    "cublas64_12.dll",
    "cublaslt64_12.dll",
];

pub fn cuda_runtime_dlls_present(dir: &Path) -> bool {
    CUDA_RUNTIME_DLLS
        .iter()
        .all(|dll| dir.join(dll).is_file())
}

pub fn missing_cuda_runtime_dlls(dir: &Path) -> Vec<&'static str> {
    CUDA_RUNTIME_DLLS
        .iter()
        .copied()
        .filter(|dll| !dir.join(dll).is_file())
        .collect()
}

fn copy_llama_artifact_if_missing(src: &Path, dest: &Path) {
    if dest.is_file() {
        return;
    }
    if std::fs::rename(src, dest).is_err() {
        if std::fs::copy(src, dest).is_ok() {
            let _ = std::fs::remove_file(src);
        }
    }
}

/// Copy llama.cpp artifacts from `~/.athena/llama-cpp` when `~/.zeus/llama-cpp` has no server yet.
/// Needed when the user upgraded from Athena to Zeus but both home folders already exist (no rename).
pub fn migrate_legacy_athena_llama_cpp() {
    let Some(dest) = zeus_llama_cpp_dir() else {
        return;
    };
    let Some(src) = legacy_athena_llama_cpp_dir() else {
        return;
    };
    if !src.is_dir() {
        return;
    }
    if dest.join(llama_server_exe_name()).is_file() {
        return;
    }
    if !src.join(llama_server_exe_name()).is_file() {
        return;
    }
    let _ = std::fs::create_dir_all(&dest);
    let Ok(entries) = std::fs::read_dir(&src) else {
        return;
    };
    for entry in entries.flatten() {
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
        copy_llama_artifact_if_missing(&path, &dest.join(name));
    }
}

/// Merge llama.cpp files from legacy `~/.zeus/bin` into `~/.zeus/llama-cpp`.
/// Runs whenever artifacts are missing in `llama-cpp` (including cudart DLLs left behind in `bin`).
pub fn migrate_legacy_bin_to_llama_cpp() {
    let Some(new_dir) = zeus_llama_cpp_dir() else {
        return;
    };
    let Some(old_bin) = legacy_zeus_bin_dir() else {
        return;
    };
    if !old_bin.is_dir() {
        return;
    }
    let _ = std::fs::create_dir_all(&new_dir);
    let Ok(entries) = std::fs::read_dir(&old_bin) else {
        return;
    };
    for entry in entries.flatten() {
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
        copy_llama_artifact_if_missing(&path, &new_dir.join(name));
    }
}

/// Detect which ggml backend ships beside `llama-server` in `bin_dir`.
pub fn detect_llama_backend(bin_dir: &Path) -> &'static str {
    if bin_dir.join("ggml-cuda.dll").is_file() {
        return "cuda";
    }
    if bin_dir.join("ggml-vulkan.dll").is_file() {
        return "vulkan";
    }
    "cpu"
}

/// Resolve `llama-server` for Zeus inference.
///
/// Priority: `ZEUS_LLAMA_SERVER` → `~/.zeus/llama-cpp/llama-server(.exe)`.
/// On Windows we intentionally **do not** fall back to `PATH` so a system CPU build
/// cannot override the managed Zeus runtime.
pub fn resolve_llama_server_binary() -> Option<PathBuf> {
    migrate_legacy_bin_to_llama_cpp();
    migrate_legacy_athena_llama_cpp();

    if let Ok(p) = std::env::var("ZEUS_LLAMA_SERVER") {
        let pb = PathBuf::from(p.trim());
        if pb.is_file() {
            return Some(pb);
        }
    }
    for dir in [zeus_llama_cpp_dir(), legacy_athena_llama_cpp_dir()]
        .into_iter()
        .flatten()
    {
        let cand = dir.join(llama_server_exe_name());
        if cand.is_file() {
            return Some(cand);
        }
    }
    #[cfg(not(windows))]
    {
        if let Ok(out) = Command::new("which").arg("llama-server").output() {
            if out.status.success() {
                let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !path.is_empty() {
                    let pb = PathBuf::from(path);
                    if pb.is_file() {
                        return Some(pb);
                    }
                }
            }
        }
    }
    None
}

/// Ensure CUDA/Vulkan DLLs next to `llama-server` resolve on Windows.
pub fn configure_llama_child(cmd: &mut Command, bin: &Path) {
    let Some(bin_dir) = bin.parent() else {
        return;
    };
    cmd.current_dir(bin_dir);
    #[cfg(windows)]
    {
        use std::ffi::OsString;
        let mut paths = OsString::from(bin_dir.as_os_str());
        paths.push(";");
        if let Some(existing) = std::env::var_os("Path") {
            paths.push(existing);
        }
        cmd.env("Path", paths);
    }
}

pub fn append_llama_launch_log(bin: &Path, summary: &str) {
    let Some(root) = zeus_data_root() else {
        return;
    };
    let log_dir = root.join("logs");
    let Ok(()) = std::fs::create_dir_all(&log_dir) else {
        return;
    };
    let log_path = log_dir.join("llama-server.log");
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        let _ = writeln!(f, "\n--- Zeus llama-server launch ---");
        let _ = writeln!(f, "binary: {}", bin.display());
        let _ = writeln!(f, "{summary}");
    }
}
