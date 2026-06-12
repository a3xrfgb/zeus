import { invoke } from "@tauri-apps/api/core";
import type { Message, Project, Thread } from "../types/chat";
import type { HardwareSnapshot } from "../types/hardware";
import type { AppSettings } from "../types/settings";
import type { LlamaRuntimeInfo, RemoveLlamaRuntimeResult } from "../types/runtime";
import type { DownloadProgress, ModelInfo, RegistryModel } from "../types/model";
import type { GalleryImage, ImageSourceKey, NanoBananaPageResult } from "../types/images";
import type { MidjourneyPageResult } from "../types/midjourney";
import type { SoraPageResult } from "../types/sora";
import type {
  ImportReceiptImageResult,
  ReceiptVisionResult,
  ReceiptVisionStatus,
} from "../types/receiptVision";
import type {
  CreateTaskInput,
  ListTasksFilter,
  TaskItem,
  TaskStats,
  UpdateTaskInput,
} from "../types/tasks";
export const api = {
  createThread: (title: string) => invoke<Thread>("create_thread", { title }),
  listThreads: () => invoke<Thread[]>("list_threads"),
  deleteThread: (threadId: string) =>
    invoke<void>("delete_thread", { threadId }),
  deleteThreads: (ids: string[]) =>
    invoke<void>("delete_threads", { ids }),
  renameThread: (threadId: string, title: string) =>
    invoke<void>("rename_thread", { threadId, title }),
  toggleThreadPinned: (threadId: string) =>
    invoke<Thread>("toggle_thread_pinned", { threadId }),
  setThreadProject: (threadId: string, projectId: string | null) =>
    invoke<Thread>("set_thread_project", { threadId, projectId }),
  assignThreadsProject: (threadIds: string[], projectId: string | null) =>
    invoke<void>("assign_threads_project", { threadIds, projectId }),
  setThreadColor: (threadId: string, color: string) =>
    invoke<Thread>("set_thread_color", { threadId, color }),
  setThreadsColor: (ids: string[], color: string) =>
    invoke<void>("set_threads_color", { ids, color }),
  listProjects: () => invoke<Project[]>("list_projects"),
  createProject: (name: string, color: string, folderPath: string | null) =>
    invoke<Project>("create_project", { name, color, folderPath }),
  updateProject: (id: string, name: string) =>
    invoke<Project>("update_project", { id, name }),
  toggleProjectStarred: (id: string) =>
    invoke<Project>("toggle_project_starred", { id }),
  toggleProjectPinned: (id: string) =>
    invoke<Project>("toggle_project_pinned", { id }),
  deleteProject: (id: string) => invoke<void>("delete_project", { id }),
  getThreadMessages: (threadId: string) =>
    invoke<Message[]>("get_thread_messages", { threadId }),
  clearThreadMessages: (threadId: string) =>
    invoke<void>("clear_thread_messages", { threadId }),
  clearAllConversations: () => invoke<void>("clear_all_conversations"),
  deleteLastAssistantMessage: (threadId: string) =>
    invoke<void>("delete_last_assistant_message", { threadId }),
  deleteMessagesFrom: (threadId: string, messageId: string) =>
    invoke<void>("delete_messages_from", { threadId, messageId }),
  deleteMessage: (threadId: string, messageId: string) =>
    invoke<void>("delete_message", { threadId, messageId }),
  sendMessage: (threadId: string, content: string, modelId: string) =>
    invoke<Message>("send_message", {
      threadId,
      content,
      modelId,
    }),
  streamChat: (
    threadId: string,
    content: string,
    modelId: string,
    skipUserInsert?: boolean,
    imageDataUrl?: string | null,
    thinkEnabled?: boolean | null,
    visionEnabled?: boolean | null,
  ) =>
    invoke<void>("stream_chat", {
      threadId,
      content,
      modelId,
      skipUserInsert: skipUserInsert ?? null,
      imageDataUrl: imageDataUrl ?? null,
      thinkEnabled: thinkEnabled ?? null,
      visionEnabled: visionEnabled ?? null,
    }),
  stopStreaming: () => invoke<void>("stop_streaming"),

  /** Optional librosa-based summary (Python). Returns null if unavailable. */
  analyzeAudioLibrosa: (fileBase64: string, fileName: string) =>
    invoke<string | null>("analyze_audio_librosa", { fileBase64, fileName }),

  listLocalModels: () => invoke<ModelInfo[]>("list_local_models"),
  listRegistryModels: () => invoke<RegistryModel[]>("list_registry_models"),
  downloadModel: (modelId: string, url: string) =>
    invoke<void>("download_model", { modelId, url }),
  downloadModelBundle: (bundleSubdir: string, files: { id: string; url: string }[]) =>
    invoke<void>("download_model_bundle", { bundleSubdir, files }),
  deleteModel: (modelId: string) =>
    invoke<void>("delete_model", { modelId }),
  getModelInfo: (modelId: string) =>
    invoke<ModelInfo>("get_model_info", { modelId }),

  getSettings: () => invoke<AppSettings>("get_settings"),
  saveSettings: (settings: AppSettings) =>
    invoke<void>("save_settings", { settings }),
  importProfilePicture: (sourcePath: string) =>
    invoke<string>("import_profile_picture", { source: sourcePath }),
  openModelsDir: () => invoke<void>("open_models_dir"),

  setAppPin: (pin: string) => invoke<void>("set_app_pin", { pin }),
  clearAppPin: () => invoke<void>("clear_app_pin"),
  verifyAppPin: (pin: string) => invoke<boolean>("verify_app_pin", { pin }),
  hasAppPin: () => invoke<boolean>("has_app_pin"),

  getHardwareSnapshot: () =>
    invoke<HardwareSnapshot>("get_hardware_snapshot"),

  restartInferenceEngine: () => invoke<void>("restart_inference_engine"),
  /** Load the GGUF into llama-server now (single active model; switches away from any previous load). */
  preloadChatModel: (modelId: string) =>
    invoke<void>("preload_chat_model", { modelId }),

  getLlamaRuntimeInfo: (variant = "cuda12") =>
    invoke<LlamaRuntimeInfo>("get_llama_runtime_info", { variant }),
  downloadLlamaRuntime: (variant = "cuda12") =>
    invoke<void>("download_llama_runtime", { variant }),
  /** Fetches only `cudart-llama-bin-win-cuda-12.4-x64.zip` when the main CUDA engine is already present. */
  downloadCudartRuntime: () => invoke<void>("download_cudart_runtime"),
  removeLlamaRuntime: () => invoke<RemoveLlamaRuntimeResult>("remove_llama_runtime"),

  fetchGalleryImages: (source: Exclude<ImageSourceKey, "sora" | "midjourney">, limit: number) =>
    invoke<GalleryImage[]>("fetch_gallery_images", { source, limit }),
  fetchNanoBananaPage: (offset: number, pageSize: number) =>
    invoke<NanoBananaPageResult>("fetch_nano_banana_page", { offset, pageSize }),
  downloadImageToDownloads: (url: string) =>
    invoke<string>("download_image_to_downloads", { url }),

  fetchSoraGalleryPage: (offset: number, pageSize: number) =>
    invoke<SoraPageResult>("fetch_sora_gallery_page", { offset, pageSize }),
  fetchSoraPrompt: (promptUrl: string) =>
    invoke<string>("fetch_sora_prompt", { promptUrl }),
  fetchMidjourneyGalleryPage: (offset: number, pageSize: number) =>
    invoke<MidjourneyPageResult>("fetch_midjourney_gallery_page", { offset, pageSize }),

  getReceiptVisionStatus: () => invoke<ReceiptVisionStatus>("get_receipt_vision_status"),
  getReceiptsFolder: () => invoke<string>("get_receipts_folder"),
  listReceiptImages: () => invoke<string[]>("list_receipt_images"),
  deleteReceiptImage: (imagePath: string) =>
    invoke<void>("delete_receipt_image", { imagePath }),
  importReceiptImage: (source: string) =>
    invoke<ImportReceiptImageResult | string>("import_receipt_image", { source }),
  preloadReceiptVisionModel: (modelId: string) =>
    invoke<void>("preload_receipt_vision_model", { modelId }),
  extractReceiptVision: (imagePath: string, modelId?: string | null) =>
    invoke<ReceiptVisionResult>("extract_receipt_vision", {
      imagePath,
      modelId: modelId ?? null,
    }),

  listTasks: (filter?: ListTasksFilter | null) =>
    invoke<TaskItem[]>("list_tasks", { filter: filter ?? null }),
  getTaskStats: () => invoke<TaskStats>("get_task_stats"),
  createTask: (input: CreateTaskInput) => invoke<TaskItem>("create_task", { input }),
  updateTask: (id: string, input: UpdateTaskInput) =>
    invoke<TaskItem>("update_task", { id, input }),
  deleteTask: (id: string) => invoke<void>("delete_task", { id }),
  toggleTaskCompleted: (id: string) => invoke<TaskItem>("toggle_task_completed", { id }),
  moveTaskDueDate: (id: string, dueDate: string | null) =>
    invoke<TaskItem>("move_task_due_date", { id, dueDate }),
};

export type { DownloadProgress };
