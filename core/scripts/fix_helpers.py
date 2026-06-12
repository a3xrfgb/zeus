#!/usr/bin/env python3
import re
from pathlib import Path

for path in Path("src/commands").glob("*.rs"):
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)
    out = []
    depth = 0
    in_helper_with_db = False
    for i, line in enumerate(lines):
        if re.match(r"^fn \w+\(db: &Db\)", line.strip()) or re.match(r"^async fn \w+\([^)]*db: &Db", line.strip()):
            in_helper_with_db = True
        elif re.match(r"^pub (async )?fn ", line):
            in_helper_with_db = False
        elif line.startswith("fn ") and "db: &Db" in line:
            in_helper_with_db = True

        if in_helper_with_db and "ctx.db.0" in line:
            line = line.replace("ctx.db.0", "db.0")
        out.append(line)
    new_text = "".join(out)
    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
        print(f"Fixed helpers in {path}")

# inference restart
inf = Path("src/commands/inference.rs")
t = inf.read_text(encoding="utf-8")
t = t.replace(
    "pub async fn restart_inference_engine(ctx: &AppContext) -> Result<(), String> {\n    inference\n        .0",
    "pub async fn restart_inference_engine(ctx: &AppContext) -> Result<(), String> {\n    ctx.inference\n        .0",
)
inf.write_text(t, encoding="utf-8")

# stop_streaming
chat = Path("src/commands/chat.rs")
t = chat.read_text(encoding="utf-8")
t = t.replace("pub fn stop_streaming(ctx: &AppContext, cancel:) -> Result<(), String>", "pub fn stop_streaming(ctx: &AppContext) -> Result<(), String>")
chat.write_text(t, encoding="utf-8")

# receipt/statement inference
for fname in ["receipt.rs"]:
    p = Path(f"src/commands/{fname}")
    t = p.read_text(encoding="utf-8")
    # Only replace inference. in pub async fn bodies - use regex for lines starting with inference
    t = re.sub(r"(\n    )inference\n        \.0", r"\1ctx.inference\n        .0", t)
    t = re.sub(r"(\n    )inference\.0", r"\1ctx.inference.0", t)
    p.write_text(t, encoding="utf-8")
    print(f"Fixed inference in {fname}")
