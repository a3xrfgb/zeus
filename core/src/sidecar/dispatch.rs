use crate::commands;
use crate::sidecar::context::AppContext;
use serde::de::DeserializeOwned;
use serde::Deserialize;

fn from_args<T: DeserializeOwned>(args: serde_json::Value) -> Result<T, String> {
    serde_json::from_value(args).map_err(|e| e.to_string())
}

fn to_val<T: serde::Serialize>(r: Result<T, String>) -> Result<serde_json::Value, String> {
    r.and_then(|v| serde_json::to_value(v).map_err(|e| e.to_string()))
}

fn to_unit(r: Result<(), String>) -> Result<serde_json::Value, String> {
    r.map(|_| serde_json::Value::Null)
}

pub async fn dispatch(ctx: &AppContext, cmd: &str, args: serde_json::Value) -> Result<serde_json::Value, String> {
    match cmd {
        "analyze_audio_librosa" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                file_base64: String,
                file_name: String,
            }
            let a: A = from_args(args)?;
            to_val(commands::attachments::analyze_audio_librosa(ctx, a.file_base64, a.file_name))
        },
        "send_message" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                thread_id: String,
                content: String,
                model_id: String,
            }
            let a: A = from_args(args)?;
            to_val(commands::chat::send_message(ctx, a.thread_id, a.content, a.model_id).await)
        },
        "stream_chat" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                thread_id: String,
                content: String,
                model_id: String,
                skip_user_insert: Option<bool>,
                image_data_url: Option<String>,
                think_enabled: Option<bool>,
                vision_enabled: Option<bool>,
            }
            let a: A = from_args(args)?;
            to_unit(commands::chat::stream_chat(ctx, a.thread_id, a.content, a.model_id, a.skip_user_insert, a.image_data_url, a.think_enabled, a.vision_enabled).await)
        },
        "get_thread_messages" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                thread_id: String,
            }
            let a: A = from_args(args)?;
            to_val(commands::chat::get_thread_messages(ctx, a.thread_id))
        },
        "create_thread" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                title: String,
            }
            let a: A = from_args(args)?;
            to_val(commands::chat::create_thread(ctx, a.title))
        },
        "delete_thread" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                thread_id: String,
            }
            let a: A = from_args(args)?;
            to_unit(commands::chat::delete_thread(ctx, a.thread_id))
        },
        "delete_threads" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                ids: Vec<String>,
            }
            let a: A = from_args(args)?;
            to_unit(commands::chat::delete_threads(ctx, a.ids))
        },
        "rename_thread" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                thread_id: String,
                title: String,
            }
            let a: A = from_args(args)?;
            to_unit(commands::chat::rename_thread(ctx, a.thread_id, a.title))
        },
        "list_threads" => to_val(commands::chat::list_threads(ctx)),
        "toggle_thread_pinned" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                thread_id: String,
            }
            let a: A = from_args(args)?;
            to_val(commands::chat::toggle_thread_pinned(ctx, a.thread_id))
        },
        "set_thread_project" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                thread_id: String,
                project_id: Option<String>,
            }
            let a: A = from_args(args)?;
            to_val(commands::chat::set_thread_project(ctx, a.thread_id, a.project_id))
        },
        "assign_threads_project" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                thread_ids: Vec<String>,
                project_id: Option<String>,
            }
            let a: A = from_args(args)?;
            to_unit(commands::chat::assign_threads_project(ctx, a.thread_ids, a.project_id))
        },
        "set_thread_color" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                thread_id: String,
                color: String,
            }
            let a: A = from_args(args)?;
            to_val(commands::chat::set_thread_color(ctx, a.thread_id, a.color))
        },
        "set_threads_color" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                ids: Vec<String>,
                color: String,
            }
            let a: A = from_args(args)?;
            to_unit(commands::chat::set_threads_color(ctx, a.ids, a.color))
        },
        "list_projects" => to_val(commands::projects::list_projects(ctx)),
        "create_project" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                name: String,
                color: String,
                folder_path: Option<String>,
            }
            let a: A = from_args(args)?;
            to_val(commands::projects::create_project(ctx, a.name, a.color, a.folder_path))
        },
        "update_project" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                id: String,
                name: String,
            }
            let a: A = from_args(args)?;
            to_val(commands::projects::update_project(ctx, a.id, a.name))
        },
        "toggle_project_starred" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                id: String,
            }
            let a: A = from_args(args)?;
            to_val(commands::projects::toggle_project_starred(ctx, a.id))
        },
        "toggle_project_pinned" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                id: String,
            }
            let a: A = from_args(args)?;
            to_val(commands::projects::toggle_project_pinned(ctx, a.id))
        },
        "delete_project" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                id: String,
            }
            let a: A = from_args(args)?;
            to_unit(commands::projects::delete_project(ctx, a.id))
        },
        "clear_thread_messages" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                thread_id: String,
            }
            let a: A = from_args(args)?;
            to_unit(commands::chat::clear_thread_messages(ctx, a.thread_id))
        },
        "clear_all_conversations" => to_unit(commands::chat::clear_all_conversations(ctx)),
        "delete_last_assistant_message" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                thread_id: String,
            }
            let a: A = from_args(args)?;
            to_unit(commands::chat::delete_last_assistant_message(ctx, a.thread_id))
        },
        "delete_messages_from" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                thread_id: String,
                message_id: String,
            }
            let a: A = from_args(args)?;
            to_unit(commands::chat::delete_messages_from(ctx, a.thread_id, a.message_id))
        },
        "delete_message" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                thread_id: String,
                message_id: String,
            }
            let a: A = from_args(args)?;
            to_unit(commands::chat::delete_message(ctx, a.thread_id, a.message_id))
        },
        "stop_streaming" => to_unit(commands::chat::stop_streaming(ctx)),
        "list_local_models" => to_val(commands::models::list_local_models(ctx).await),
        "download_model" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                model_id: String,
                url: String,
            }
            let a: A = from_args(args)?;
            to_unit(commands::models::download_model(ctx, a.model_id, a.url).await)
        },
        "download_model_bundle" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                bundle_subdir: String,
                files: Vec<crate::commands::models::BundleFile>,
            }
            let a: A = from_args(args)?;
            to_unit(commands::models::download_model_bundle(ctx, a.bundle_subdir, a.files).await)
        },
        "delete_model" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                model_id: String,
            }
            let a: A = from_args(args)?;
            to_unit(commands::models::delete_model(ctx, a.model_id))
        },
        "get_model_info" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                model_id: String,
            }
            let a: A = from_args(args)?;
            to_val(commands::models::get_model_info(ctx, a.model_id))
        },
        "list_registry_models" => to_val(commands::models::list_registry_models(ctx).await),
        "get_settings" => to_val(commands::settings::get_settings(ctx)),
        "save_settings" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                settings: crate::types::AppSettings,
            }
            let a: A = from_args(args)?;
            to_unit(commands::settings::save_settings(ctx, a.settings))
        },
        "import_profile_picture" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                source: String,
            }
            let a: A = from_args(args)?;
            to_val(commands::settings::import_profile_picture(ctx, a.source))
        },
        "open_models_dir" => to_unit(commands::settings::open_models_dir(ctx)),
        "set_app_pin" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                pin: String,
            }
            let a: A = from_args(args)?;
            to_unit(commands::security::set_app_pin(ctx, a.pin))
        },
        "clear_app_pin" => to_unit(commands::security::clear_app_pin(ctx)),
        "verify_app_pin" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                pin: String,
            }
            let a: A = from_args(args)?;
            to_val(commands::security::verify_app_pin(ctx, a.pin))
        },
        "has_app_pin" => to_val(commands::security::has_app_pin(ctx)),
        "get_hardware_snapshot" => to_val(commands::hardware::get_hardware_snapshot(ctx)),
        "restart_inference_engine" => to_unit(commands::inference::restart_inference_engine(ctx).await),
        "preload_chat_model" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                model_id: String,
            }
            let a: A = from_args(args)?;
            to_unit(commands::inference::preload_chat_model(ctx, a.model_id).await)
        },
        "get_llama_runtime_info" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                variant: String,
            }
            let a: A = from_args(args)?;
            to_val(commands::runtime::get_llama_runtime_info(ctx, a.variant).await)
        },
        "download_llama_runtime" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                variant: String,
            }
            let a: A = from_args(args)?;
            to_unit(commands::runtime::download_llama_runtime(ctx, a.variant).await)
        },
        "download_cudart_runtime" => to_unit(commands::runtime::download_cudart_runtime(ctx).await),
        "remove_llama_runtime" => to_val(commands::runtime::remove_llama_runtime(ctx).await),
        "fetch_gallery_images" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                source: String,
                limit: usize,
            }
            let a: A = from_args(args)?;
            to_val(commands::images::fetch_gallery_images(ctx, a.source, a.limit).await)
        },
        "fetch_nano_banana_page" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                offset: usize,
                page_size: usize,
            }
            let a: A = from_args(args)?;
            to_val(commands::images::fetch_nano_banana_page(ctx, a.offset, a.page_size).await)
        },
        "download_image_to_downloads" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                url: String,
            }
            let a: A = from_args(args)?;
            to_val(commands::images::download_image_to_downloads(ctx, a.url).await)
        },
        "fetch_sora_gallery_page" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                offset: usize,
                page_size: usize,
            }
            let a: A = from_args(args)?;
            to_val(commands::sora::fetch_sora_gallery_page(ctx, a.offset, a.page_size).await)
        },
        "fetch_sora_prompt" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                prompt_url: String,
            }
            let a: A = from_args(args)?;
            to_val(commands::sora::fetch_sora_prompt(ctx, a.prompt_url).await)
        },
        "fetch_midjourney_gallery_page" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                offset: usize,
                page_size: usize,
            }
            let a: A = from_args(args)?;
            to_val(commands::midjourney::fetch_midjourney_gallery_page(ctx, a.offset, a.page_size).await)
        },
        "get_receipt_vision_status" => to_val(commands::receipt::get_receipt_vision_status(ctx).await),
        "get_receipts_folder" => to_val(commands::receipt::get_receipts_folder(ctx)),
        "list_receipt_images" => to_val(commands::receipt::list_receipt_images(ctx)),
        "delete_receipt_image" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                image_path: String,
            }
            let a: A = from_args(args)?;
            to_unit(commands::receipt::delete_receipt_image(ctx, a.image_path))
        },
        "import_receipt_image" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                source: String,
            }
            let a: A = from_args(args)?;
            to_val(commands::receipt::import_receipt_image(ctx, a.source))
        },
        "preload_receipt_vision_model" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                model_id: String,
            }
            let a: A = from_args(args)?;
            to_unit(commands::receipt::preload_receipt_vision_model(ctx, a.model_id).await)
        },
        "extract_receipt_vision" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                image_path: String,
                model_id: Option<String>,
            }
            let a: A = from_args(args)?;
            to_val(commands::receipt::extract_receipt_vision(ctx, a.image_path, a.model_id).await)
        },
        "list_tasks" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                filter: Option<crate::types::ListTasksFilter>,
            }
            let a: A = from_args(args)?;
            to_val(commands::tasks::list_tasks(ctx, a.filter))
        },
        "get_task_stats" => to_val(commands::tasks::get_task_stats(ctx)),
        "create_task" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                input: crate::types::CreateTaskInput,
            }
            let a: A = from_args(args)?;
            to_val(commands::tasks::create_task(ctx, a.input))
        },
        "update_task" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                id: String,
                input: crate::types::UpdateTaskInput,
            }
            let a: A = from_args(args)?;
            to_val(commands::tasks::update_task(ctx, a.id, a.input))
        },
        "delete_task" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                id: String,
            }
            let a: A = from_args(args)?;
            to_unit(commands::tasks::delete_task(ctx, a.id))
        },
        "toggle_task_completed" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                id: String,
            }
            let a: A = from_args(args)?;
            to_val(commands::tasks::toggle_task_completed(ctx, a.id))
        },
        "move_task_due_date" => {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct A {
                id: String,
                due_date: Option<String>,
            }
            let a: A = from_args(args)?;
            to_val(commands::tasks::move_task_due_date(ctx, a.id, a.due_date))
        },
        _ => Err(format!("unknown command: {cmd}")),
    }
}