#!/usr/bin/env python3
import re
from pathlib import Path

paths = list(Path("src").rglob("*.rs"))

for path in paths:
    text = path.read_text(encoding="utf-8")
    orig = text

    # Remove orphaned state parameter lines
    text = re.sub(r"\n\s*db:,\n", "\n", text)
    text = re.sub(r"\n\s*inference:,\n", "\n", text)
    text = re.sub(r"\n\s*cancel:,\n", "\n", text)
    text = re.sub(r"\n\s*ctl:,\n", "\n", text)
    text = re.sub(r",\s*db:,", ",", text)
    text = re.sub(r",\s*inference:,", ",", text)
    text = re.sub(r",\s*cancel:,", ",", text)
    text = re.sub(r",\s*ctl:,", ",", text)

    # Fix trailing commas before closing paren
    text = re.sub(r",\s*\)", ")", text)

    # task_is_overdue should not have ctx
    text = text.replace(
        "pub fn task_is_overdue(ctx: &AppContext, task: &TaskItem)",
        "pub fn task_is_overdue(task: &TaskItem)",
    )

    # ai_hub stream closure - use events clone pattern
    if "lm_studio_chat_stream" in text and "app_emit" in text:
        text = text.replace("let app_emit = app.clone();", "let events = &ctx.events;")
        text = text.replace("app_emit.emit(", "events.emit(")

    # runtime download_zip_to_path_emit calls with &app
    text = text.replace("download_zip_to_path_emit(\n            &app,", "download_zip_to_path_emit(\n            &ctx.events,")
    text = text.replace("download_zip_to_path_emit(\n        &app,", "download_zip_to_path_emit(\n        &ctx.events,")

    # models download - &app -> &ctx.events  
    text = text.replace("download_stream_to_file(\n        &app,", "download_stream_to_file(\n        &ctx.events,")

    if text != orig:
        path.write_text(text, encoding="utf-8")
        print(f"Fixed {path}")
