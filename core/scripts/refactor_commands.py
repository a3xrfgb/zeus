#!/usr/bin/env python3
"""Bulk-refactor command files from Tauri State to AppContext."""
import re
from pathlib import Path

SRC = Path("src/commands")
FILES = list(SRC.glob("*.rs"))

for path in FILES:
    text = path.read_text(encoding="utf-8")
    orig = text

    # Remove tauri command attributes
    text = re.sub(r"#\[tauri::command\]\r?\n", "", text)

    # Replace tauri imports
    text = re.sub(
        r"use tauri::\{[^}]+\};\r?\n",
        "use crate::sidecar::context::AppContext;\n",
        text,
    )
    text = re.sub(r"use tauri::State;\r?\n", "use crate::sidecar::context::AppContext;\n", text)
    text = re.sub(
        r"use tauri::\{AppHandle, Emitter\};\r?\n",
        "use crate::sidecar::context::{AppContext, EventBus};\n",
        text,
    )

    # Replace tauri::State in signatures
    text = re.sub(r"tauri::State<'_, Db>", "StatePLACEHOLDER", text)
    text = re.sub(r"State<'_, Db>", "StatePLACEHOLDER", text)
    text = re.sub(r"tauri::State<'_, InferenceHandle>", "InfPLACEHOLDER", text)
    text = re.sub(r"State<'_, InferenceHandle>", "InfPLACEHOLDER", text)
    text = re.sub(r"tauri::State<'_, StreamCancel>", "CancelPLACEHOLDER", text)
    text = re.sub(r"State<'_, StreamCancel>", "CancelPLACEHOLDER", text)
    text = re.sub(r"tauri::State<'_, HttpServerCtl>", "CtlPLACEHOLDER", text)

    # Remove AppHandle and Window params
    text = re.sub(r",?\s*app:\s*AppHandle", "", text)
    text = re.sub(r",?\s*window:\s*Window", "", text)
    text = re.sub(r"app:\s*AppHandle,?\s*", "", text)
    text = re.sub(r"window:\s*Window,?\s*", "", text)

    # Convert placeholder state params to ctx
    text = re.sub(r",?\s*StatePLACEHOLDER", "", text)
    text = re.sub(r",?\s*InfPLACEHOLDER", "", text)
    text = re.sub(r",?\s*CancelPLACEHOLDER", "", text)
    text = re.sub(r",?\s*CtlPLACEHOLDER", "", text)

    # Add ctx as first param to pub fn / pub async fn if not present
    def add_ctx(m):
        prefix, rest = m.group(1), m.group(2)
        if rest.lstrip().startswith("ctx: &AppContext"):
            return m.group(0)
        return f"{prefix}ctx: &AppContext, {rest}"

    text = re.sub(r"(pub async fn \w+\()(\s*)", add_ctx, text)
    text = re.sub(r"(pub fn \w+\()(\s*)", add_ctx, text)

    # Fix double commas
    text = re.sub(r"\(\s*,", "(", text)
    text = re.sub(r",\s*,", ", ", text)

    # Replace db.0 with ctx.db.0
    text = text.replace("db.0", "ctx.db.0")

    # Replace inference.0 with ctx.inference.0 (careful - only when not ctx.inference already)
    text = re.sub(r"(?<!ctx\.)(?<!\.)\binference\.0\b", "ctx.inference.0", text)

    # Replace cancel.0 with ctx.cancel.0
    text = re.sub(r"(?<!ctx\.)\bcancel\.0\b", "ctx.cancel.0", text)

    # Replace ctl. with ctx.http_ctl. for server.rs patterns
    text = re.sub(r"(?<!http_)\bctl\.inner\b", "ctx.http_ctl.inner", text)

    # store/helper &db patterns
    text = text.replace("&db,", "&ctx.db,")
    text = text.replace("(&db,", "(&ctx.db,")
    text = text.replace("&db)", "&ctx.db)")
    text = text.replace("save_hub_settings(&db,", "save_hub_settings(&ctx.db,")
    text = text.replace("with_conn(&db,", "with_conn(&ctx.db,")
    text = text.replace("get_provider_credential(&db,", "get_provider_credential(&ctx.db,")
    text = text.replace("update_provider_status(\n        &db,", "update_provider_status(\n        &ctx.db,")
    text = text.replace("upsert_provider(&db,", "upsert_provider(&ctx.db,")
    text = text.replace("delete_provider(&db,", "delete_provider(&ctx.db,")
    text = text.replace("upsert_mcp_server(&db,", "upsert_mcp_server(&ctx.db,")
    text = text.replace("delete_mcp_server(&db,", "delete_mcp_server(&ctx.db,")
    text = text.replace("get_mcp_credential(&db,", "get_mcp_credential(&ctx.db,")
    text = text.replace("update_mcp_status(\n        &db,", "update_mcp_status(\n        &ctx.db,")
    text = text.replace("log_request(&db,", "log_request(&ctx.db,")
    text = text.replace("get_integration_credential(&db,", "get_integration_credential(&ctx.db,")
    text = text.replace("update_integration_status(\n        &db,", "update_integration_status(\n        &ctx.db,")

    # emit replacements
    text = text.replace("app.emit(", "ctx.events.emit(")
    text = text.replace("app_emit.emit(", "ctx.events.emit(")
    text = text.replace("window.emit(", "ctx.events.emit(")

    # AppHandle in function bodies / signatures for inner functions
    text = text.replace("&AppHandle", "&EventBus")
    text = text.replace("AppHandle", "EventBus")

    # maybe_auto_title_thread
    text = text.replace("maybe_auto_title_thread(&*db, &inference,", "maybe_auto_title_thread(&ctx.db, &ctx.inference,")
    text = text.replace("maybe_auto_title_thread(&ctx.db, &ctx.inference, &base, &thread_id)", "maybe_auto_title_thread(&ctx.db, &ctx.inference, &base, &thread_id)")

    # huggingface download calls - &app -> &ctx.events
    text = text.replace("download_stream_to_file(\n        &app,", "download_stream_to_file(\n        &ctx.events,")
    text = text.replace("&app,\n", "&ctx.events,\n")

    # CARGO_MANIFEST_DIR scripts
    text = text.replace(
        'Path::new(env!("CARGO_MANIFEST_DIR")).join("scripts/audio_librosa_summary.py")',
        'Path::new(&crate::sidecar::context::scripts_dir()).join("audio_librosa_summary.py")',
    )
    text = text.replace(
        'Path::new(env!("CARGO_MANIFEST_DIR")).join("scripts").join(name)',
        'Path::new(&crate::sidecar::context::scripts_dir()).join(name)',
    )

    # stop_server_inner(&ctl) -> stop_server_inner(&ctx.http_ctl)
    text = text.replace("stop_server_inner(&ctl)", "stop_server_inner(&ctx.http_ctl)")

    if text != orig:
        path.write_text(text, encoding="utf-8")
        print(f"Updated {path}")

# huggingface.rs
hf = Path("src/huggingface.rs")
text = hf.read_text(encoding="utf-8")
text = re.sub(r"use tauri::\{AppHandle, Emitter\};\r?\n", "use crate::sidecar::context::EventBus;\n", text)
text = text.replace("app: &AppHandle,", "events: &EventBus,")
text = text.replace("app.emit(", "events.emit(")
hf.write_text(text, encoding="utf-8")
print("Updated huggingface.rs")

# runtime.rs inner function
rt = Path("src/commands/runtime.rs")
text = rt.read_text(encoding="utf-8")
text = text.replace("app: &AppHandle,", "events: &EventBus,")
text = text.replace("app.emit(", "events.emit(")
text = text.replace("download_zip_to_path_emit(\n            &app,", "download_zip_to_path_emit(\n            &ctx.events,")
text = text.replace("let _ = app;", "let _ = ctx;")
rt.write_text(text, encoding="utf-8")
print("Updated runtime.rs")
