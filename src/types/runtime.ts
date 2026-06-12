/** Response from `get_llama_runtime_info` (ggml-org/llama.cpp releases). */
export interface LlamaRuntimeInfo {
  latestTag: string;
  installedTag: string | null;
  updateAvailable: boolean;
  assetName: string | null;
  assetUrl: string | null;
  assetSize: number | null;
  /** `cudart-llama-bin-win-cuda-12.4-x64.zip` — CUDA runtime DLLs (paired with CUDA 12 engine). */
  cudartAssetName: string | null;
  cudartUrl: string | null;
  cudartSize: number | null;
  binDir: string | null;
  /** Same as binDir — ~/.zeus/llama-cpp install location. */
  llamaCppDir?: string | null;
  /** Resolved llama-server path (ZEUS_LLAMA_SERVER or ~/.zeus/llama-cpp). */
  llamaServerPath: string | null;
  /** Backend detected beside llama-server: cpu | cuda | vulkan. */
  installedBackend: "cpu" | "cuda" | "vulkan" | null;
  /** Selected variant does not match the installed binary (e.g. CUDA 12 selected but CPU build installed). */
  backendMismatch: boolean;
  /** CUDA engine is installed but cudart DLLs from the companion zip are missing. */
  cudartMissing?: boolean;
  /** e.g. ["cudart64_12.dll", "cublas64_12.dll"] when cudart zip was not extracted. */
  missingCudartDlls?: string[];
  /** Automated download + extract is implemented for Windows only in this build. */
  supported: boolean;
}

export interface RemoveLlamaRuntimeResult {
  removed: number;
  bytesFreed: number;
  binDir?: string;
  llamaCppDir?: string;
}

/** Zeus ships CUDA 12 llama.cpp on Windows only. */
export const CUDA_RUNTIME_VARIANT = "cuda12" as const;
export type RuntimeVariant = typeof CUDA_RUNTIME_VARIANT;
