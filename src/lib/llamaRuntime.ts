import { api } from "./tauri";
import { CUDA_RUNTIME_VARIANT } from "../types/runtime";

/** When inference cannot run, returns a short user-facing message; otherwise null. */
export async function getLlamaRuntimeBlockReason(): Promise<string | null> {
  const info = await api.getLlamaRuntimeInfo(CUDA_RUNTIME_VARIANT);
  if (!info.llamaServerPath) {
    return "llama-server is not installed. Open Settings → Runtime and click Download & install.";
  }
  if (info.backendMismatch) {
    return "CUDA llama.cpp build required. Open Settings → Runtime and click Download & install.";
  }
  if (info.cudartMissing) {
    return "CUDA runtime DLLs are missing. Open Settings → Runtime and click Download & install.";
  }
  return null;
}
