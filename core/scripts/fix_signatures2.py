#!/usr/bin/env python3
import re
from pathlib import Path

# Remove broken trailing dummy params like `db:)`, `ctl:)`, `inference:)`
DUMMY_PARAMS = re.compile(r",\s*(db|ctl|inference):\)")

for path in Path("src/commands").glob("*.rs"):
    text = path.read_text(encoding="utf-8")
    orig = text
    text = DUMMY_PARAMS.sub(")", text)
    text = re.sub(r",\s*(db|ctl|inference):\s*,", ",", text)
    text = re.sub(r"\(\s*(db|ctl|inference):\s*,", "(", text)

    if "AppContext" in text and "use crate::sidecar::context::AppContext" not in text:
        # insert after first use line block
        if "use crate::sidecar::context::{AppContext, EventBus}" not in text:
            first_use = text.find("use ")
            if first_use >= 0:
                end = text.find("\n\n", first_use)
                if end < 0:
                    end = text.find("\n", first_use)
                text = text[:end] + "\nuse crate::sidecar::context::AppContext;\n" + text[end:]

    if text != orig:
        path.write_text(text, encoding="utf-8")
        print(f"Fixed params/import {path}")

# chat.rs internal function fixes
chat = Path("src/commands/chat.rs")
text = chat.read_text(encoding="utf-8")
text = text.replace("match ctx.db.0.lock()", "match db.0.lock()")
# only in maybe_auto_title - the second occurrence at line 224 should be db not ctx
# Already fixed both with global replace above
chat.write_text(text, encoding="utf-8")
print("Fixed chat.rs internal db refs")

# models.rs inference
models = Path("src/commands/models.rs")
text = models.read_text(encoding="utf-8")
text = text.replace("let active_s = inference\n        .0", "let active_s = ctx.inference\n        .0")
models.write_text(text, encoding="utf-8")
print("Fixed models.rs")

# inference.rs
inf = Path("src/commands/inference.rs")
text = inf.read_text(encoding="utf-8")
text = text.replace(
    "pub async fn restart_inference_engine(ctx: &AppContext, inference:) -> Result<(), String> {\n    inference\n        .0",
    "pub async fn restart_inference_engine(ctx: &AppContext) -> Result<(), String> {\n    ctx.inference\n        .0",
)
text = text.replace(
    "    inference\n        .0\n        .ensure_llama_server",
    "    ctx.inference\n        .0\n        .ensure_llama_server",
)
inf.write_text(text, encoding="utf-8")
print("Fixed inference.rs")

# server.rs stop_server_inner
server = Path("src/commands/server.rs")
text = server.read_text(encoding="utf-8")
text = text.replace(
    "async fn stop_server_inner(ctl: &HttpServerCtl) {\n    let mut g = ctx.http_ctl.inner.lock().ok();",
    "async fn stop_server_inner(ctl: &HttpServerCtl) {\n    let mut g = ctl.inner.lock().ok();",
)
if "use crate::sidecar::context::AppContext" not in text:
    text = "use crate::sidecar::context::AppContext;\n" + text
server.write_text(text, encoding="utf-8")
print("Fixed server.rs")

# attachments import
att = Path("src/commands/attachments.rs")
text = att.read_text(encoding="utf-8")
if "use crate::sidecar::context::AppContext" not in text:
    text = "use crate::sidecar::context::AppContext;\n" + text
att.write_text(text, encoding="utf-8")
print("Fixed attachments.rs")

# hardware import
hw = Path("src/commands/hardware.rs")
text = hw.read_text(encoding="utf-8")
if "use crate::sidecar::context::AppContext" not in text:
    text = "use crate::sidecar::context::AppContext;\n" + text
hw.write_text(text, encoding="utf-8")
print("Fixed hardware.rs")

# api_hub import
api = Path("src/commands/api_hub.rs")
text = api.read_text(encoding="utf-8")
if "use crate::sidecar::context::AppContext" not in text:
    text = "use crate::sidecar::context::AppContext;\n" + text
api.write_text(text, encoding="utf-8")
print("Fixed api_hub.rs")

# ai_hub import check
ai = Path("src/commands/ai_hub.rs")
text = ai.read_text(encoding="utf-8")
if "use crate::sidecar::context::AppContext" not in text:
    text = "use crate::sidecar::context::AppContext;\n" + text
# fix stream closure - clone events
if "let events = &ctx.events;" in text and "ctx.events.emit" in text:
    text = text.replace("let events = &ctx.events;", "let events = ctx.events.clone();")
    text = text.replace("let _ = ctx.events.emit(\n                \"ai-hub-token\"", "let _ = events.emit(\n                \"ai-hub-token\"")
ai.write_text(text, encoding="utf-8")
print("Fixed ai_hub.rs")

# Add Clone to EventBus
ctx_path = Path("src/sidecar/context.rs")
text = ctx_path.read_text(encoding="utf-8")
if "impl Clone for EventBus" not in text:
    text = text.replace(
        "pub struct EventBus {\n    tx: broadcast::Sender<(String, serde_json::Value)>,\n}\n\nimpl EventBus {",
        "pub struct EventBus {\n    tx: broadcast::Sender<(String, serde_json::Value)>,\n}\n\nimpl Clone for EventBus {\n    fn clone(&self) -> Self {\n        Self { tx: self.tx.clone() }\n    }\n}\n\nimpl EventBus {",
    )
ctx_path.write_text(text, encoding="utf-8")
print("Added EventBus Clone")
