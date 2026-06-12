#!/usr/bin/env python3
"""Generate sidecar/dispatch.rs from command manifest."""

cmds = [
    ("analyze_audio_librosa", "attachments", False, [("file_base64", "String"), ("file_name", "String")], "result"),
    ("send_message", "chat", True, [("thread_id", "String"), ("content", "String"), ("model_id", "String")], "result"),
    ("stream_chat", "chat", True, [("thread_id", "String"), ("content", "String"), ("model_id", "String"), ("skip_user_insert", "Option<bool>"), ("image_data_url", "Option<String>"), ("think_enabled", "Option<bool>")], "unit"),
    ("get_thread_messages", "chat", False, [("thread_id", "String")], "result"),
    ("create_thread", "chat", False, [("title", "String")], "result"),
    ("delete_thread", "chat", False, [("thread_id", "String")], "unit"),
    ("delete_threads", "chat", False, [("ids", "Vec<String>")], "unit"),
    ("rename_thread", "chat", False, [("thread_id", "String"), ("title", "String")], "unit"),
    ("list_threads", "chat", False, [], "result"),
    ("toggle_thread_pinned", "chat", False, [("thread_id", "String")], "result"),
    ("set_thread_project", "chat", False, [("thread_id", "String"), ("project_id", "Option<String>")], "result"),
    ("assign_threads_project", "chat", False, [("thread_ids", "Vec<String>"), ("project_id", "Option<String>")], "unit"),
    ("set_thread_color", "chat", False, [("thread_id", "String"), ("color", "String")], "result"),
    ("set_threads_color", "chat", False, [("ids", "Vec<String>"), ("color", "String")], "unit"),
    ("list_projects", "projects", False, [], "result"),
    ("create_project", "projects", False, [("name", "String"), ("color", "String"), ("folder_path", "Option<String>")], "result"),
    ("update_project", "projects", False, [("id", "String"), ("name", "String")], "result"),
    ("toggle_project_starred", "projects", False, [("id", "String")], "result"),
    ("toggle_project_pinned", "projects", False, [("id", "String")], "result"),
    ("delete_project", "projects", False, [("id", "String")], "unit"),
    ("clear_thread_messages", "chat", False, [("thread_id", "String")], "unit"),
    ("clear_all_conversations", "chat", False, [], "unit"),
    ("delete_last_assistant_message", "chat", False, [("thread_id", "String")], "unit"),
    ("delete_messages_from", "chat", False, [("thread_id", "String"), ("message_id", "String")], "unit"),
    ("delete_message", "chat", False, [("thread_id", "String"), ("message_id", "String")], "unit"),
    ("stop_streaming", "chat", False, [], "unit"),
    ("list_local_models", "models", True, [], "result"),
    ("download_model", "models", True, [("model_id", "String"), ("url", "String")], "unit"),
    ("download_model_bundle", "models", True, [("bundle_subdir", "String"), ("files", "Vec<crate::commands::models::BundleFile>")], "unit"),
    ("delete_model", "models", False, [("model_id", "String")], "unit"),
    ("get_model_info", "models", False, [("model_id", "String")], "result"),
    ("list_registry_models", "models", True, [], "result"),
    ("get_settings", "settings", False, [], "result"),
    ("save_settings", "settings", False, [("settings", "crate::types::AppSettings")], "unit"),
    ("import_profile_picture", "settings", False, [("source", "String")], "result"),
    ("open_models_dir", "settings", False, [], "unit"),
    ("start_server", "server", True, [("port", "u16"), ("api_key", "Option<String>")], "unit"),
    ("stop_server", "server", True, [], "unit"),
    ("get_server_status", "server", False, [], "result"),
    ("set_app_pin", "security", False, [("pin", "String")], "unit"),
    ("clear_app_pin", "security", False, [], "unit"),
    ("verify_app_pin", "security", False, [("pin", "String")], "result"),
    ("has_app_pin", "security", False, [], "result"),
    ("get_hardware_snapshot", "hardware", False, [], "result"),
    ("restart_inference_engine", "inference", True, [], "unit"),
    ("preload_chat_model", "inference", True, [("model_id", "String")], "unit"),
    ("get_llama_runtime_info", "runtime", True, [("variant", "String")], "result"),
    ("download_llama_runtime", "runtime", True, [("variant", "String")], "unit"),
    ("download_cudart_runtime", "runtime", True, [], "unit"),
    ("remove_llama_runtime", "runtime", True, [], "result"),
    ("fetch_gallery_images", "images", True, [("source", "String"), ("limit", "usize")], "result"),
    ("fetch_nano_banana_page", "images", True, [("offset", "usize"), ("page_size", "usize")], "result"),
    ("download_image_to_downloads", "images", True, [("url", "String")], "result"),
    ("fetch_sora_gallery_page", "sora", True, [("offset", "usize"), ("page_size", "usize")], "result"),
    ("fetch_sora_prompt", "sora", True, [("prompt_url", "String")], "result"),
    ("fetch_midjourney_gallery_page", "midjourney", True, [("offset", "usize"), ("page_size", "usize")], "result"),
    ("get_receipt_vision_status", "receipt", True, [], "result"),
    ("get_receipts_folder", "receipt", False, [], "result"),
    ("list_receipt_images", "receipt", False, [], "result"),
    ("delete_receipt_image", "receipt", False, [("image_path", "String")], "unit"),
    ("import_receipt_image", "receipt", False, [("source", "String")], "result"),
    ("preload_receipt_vision_model", "receipt", True, [("model_id", "String")], "unit"),
    ("extract_receipt_vision", "receipt", True, [("image_path", "String"), ("model_id", "Option<String>")], "result"),
    ("list_tasks", "tasks", False, [("filter", "Option<crate::types::ListTasksFilter>")], "result"),
    ("get_task_stats", "tasks", False, [], "result"),
    ("create_task", "tasks", False, [("input", "crate::types::CreateTaskInput")], "result"),
    ("update_task", "tasks", False, [("id", "String"), ("input", "crate::types::UpdateTaskInput")], "result"),
    ("delete_task", "tasks", False, [("id", "String")], "unit"),
    ("toggle_task_completed", "tasks", False, [("id", "String")], "result"),
    ("move_task_due_date", "tasks", False, [("id", "String"), ("due_date", "Option<String>")], "result"),
    ("get_ai_hub_state", "ai_hub", False, [], "result"),
    ("save_ai_hub_settings", "ai_hub", False, [("settings", "crate::ai_hub::types::AiHubSettings")], "result"),
    ("upsert_ai_provider", "ai_hub", False, [("input", "crate::ai_hub::types::UpsertAiProviderInput")], "result"),
    ("delete_ai_provider", "ai_hub", False, [("id", "String")], "unit"),
    ("test_ai_provider", "ai_hub", True, [("id", "String")], "result"),
    ("upsert_mcp_server_cmd", "ai_hub", False, [("input", "crate::ai_hub::types::UpsertMcpServerInput")], "result"),
    ("delete_mcp_server_cmd", "ai_hub", False, [("id", "String")], "unit"),
    ("test_mcp_server_cmd", "ai_hub", True, [("id", "String")], "result"),
    ("list_lm_studio_models", "ai_hub", True, [("endpoint", "Option<String>")], "result"),
    ("test_lm_studio_connection", "ai_hub", True, [("endpoint", "Option<String>")], "result"),
    ("list_mcp_tools_for_server", "ai_hub", True, [("server_id", "String")], "result"),
    ("list_all_mcp_tools", "ai_hub", True, [], "result"),
    ("invoke_mcp_tool", "ai_hub", True, [("server_id", "String"), ("tool_name", "String"), ("arguments", "serde_json::Value")], "result"),
    ("lm_studio_chat", "ai_hub", True, [("request", "crate::ai_hub::types::LmStudioChatRequest")], "result"),
    ("lm_studio_chat_stream", "ai_hub", True, [("request", "crate::ai_hub::types::LmStudioChatRequest"), ("stream_id", "String")], "result"),
    ("get_ai_hub_debug_logs", "ai_hub", False, [], "val"),
    ("clear_ai_hub_debug_logs", "ai_hub", False, [], "void"),
    ("get_api_hub_state", "api_hub", False, [], "result"),
    ("save_api_hub_settings", "api_hub", False, [("settings", "crate::api_hub::types::ApiHubSettings")], "result"),
    ("upsert_api_integration", "api_hub", False, [("input", "crate::api_hub::types::UpsertApiIntegrationInput")], "result"),
    ("delete_api_integration", "api_hub", False, [("id", "String")], "unit"),
    ("test_api_integration", "api_hub", True, [("id", "String")], "result"),
    ("list_integration_catalog", "api_hub", False, [], "val"),
    ("list_api_endpoints", "api_hub", False, [], "val"),
    ("execute_api_request", "api_hub", True, [("input", "crate::api_hub::types::ExecuteApiRequestInput")], "result"),
    ("get_api_request_history", "api_hub", False, [("limit", "Option<u32>")], "result"),
    ("clear_api_request_history", "api_hub", False, [], "unit"),
    ("upsert_api_webhook", "api_hub", False, [("input", "crate::api_hub::types::UpsertWebhookInput")], "result"),
    ("delete_api_webhook", "api_hub", False, [("id", "String")], "unit"),
    ("get_api_webhook_logs", "api_hub", False, [("webhook_id", "Option<String>"), ("limit", "Option<u32>")], "result"),
    ("retry_api_webhook_delivery", "api_hub", False, [("log_id", "String")], "result"),
    ("upsert_api_automation", "api_hub", False, [("input", "crate::api_hub::types::UpsertAutomationInput")], "result"),
    ("delete_api_automation", "api_hub", False, [("id", "String")], "unit"),
    ("get_api_usage_metrics", "api_hub", False, [], "result"),
    ("get_api_audit_logs", "api_hub", False, [("limit", "Option<u32>")], "result"),
    ("rotate_api_credential", "api_hub", False, [("integration_id", "String"), ("new_secret", "String")], "unit"),
    ("get_api_hub_debug_logs", "api_hub", False, [], "val"),
    ("clear_api_hub_debug_logs", "api_hub", False, [], "void"),
]


def gen_body(name, mod, is_async, params, ret):
    aw = ".await" if is_async else ""
    call = ", ".join(["ctx"] + [f"a.{p[0]}" for p in params])
    wrap_result = "to_val" if ret in ("result", "val") else "to_unit"
    if ret == "void":
        return f"""{{
            commands::{mod}::{name}({call}){aw};
            to_unit(Ok(()))
        }}"""
    if not params:
        if ret == "val":
            return f"{wrap_result}(Ok(commands::{mod}::{name}(ctx){aw}))"
        return f"{wrap_result}(commands::{mod}::{name}(ctx){aw})"
    fields = "\n".join(f"                {n}: {t}," for n, t in params)
    return f"""{{
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {{
{fields}
            }}
            let a: A = from_args(args)?;
            {wrap_result}(commands::{mod}::{name}({call}){aw})
        }}"""


out = [
    "use crate::commands;",
    "use crate::sidecar::context::AppContext;",
    "use serde::de::DeserializeOwned;",
    "use serde::Deserialize;",
    "",
    "fn from_args<T: DeserializeOwned>(args: serde_json::Value) -> Result<T, String> {",
    "    serde_json::from_value(args).map_err(|e| e.to_string())",
    "}",
    "",
    "fn to_val<T: serde::Serialize>(r: Result<T, String>) -> Result<serde_json::Value, String> {",
    "    r.and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))",
    "}",
    "",
    "fn to_unit(r: Result<(), String>) -> Result<serde_json::Value, String> {",
    "    r.map(|_| serde_json::Value::Null)",
    "}",
    "",
    "pub async fn dispatch(ctx: &AppContext, cmd: &str, args: serde_json::Value) -> Result<serde_json::Value, String> {",
    "    match cmd {",
]
for name, mod, is_async, params, ret in cmds:
    body = gen_body(name, mod, is_async, params, ret)
    out.append(f'        "{name}" => {body},')
out += [
    '        _ => Err(format!("unknown command: {cmd}")),',
    "    }",
    "}",
]

path = "src/sidecar/dispatch.rs"
with open(path, "w", encoding="utf-8") as f:
    f.write("\n".join(out))
print(f"Wrote {path} ({len(cmds)} commands)")
