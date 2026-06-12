//! Mirror chat threads to JSON files under `~/.zeus/chats/` and project `chats/` folders.

use crate::db;
use crate::types::{Message, Thread};
use chrono::Utc;
use rusqlite::{Connection, Row};
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};

pub const ATHENA_CHATS_DIR: &str = "chats";
pub const PROJECT_CHATS_SUBDIR: &str = "chats";

/// Safe folder/file stem from a project or thread title.
pub fn sanitize_fs_name(name: &str) -> String {
    let mut s = String::new();
    for c in name.trim().chars() {
        if matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') {
            s.push('-');
        } else if !c.is_control() {
            s.push(c);
        }
    }
    let s = s.trim().trim_matches('.').to_string();
    if s.is_empty() {
        "untitled".into()
    } else if s.len() > 80 {
        format!("{}…", &s[..77])
    } else {
        s
    }
}

/// `{parent}/{base}`, `{parent}/{base}-2`, … when the name already exists.
pub fn unique_subdir(parent: &Path, base: &str) -> PathBuf {
    let base = sanitize_fs_name(base);
    let first = parent.join(&base);
    if !first.exists() {
        return first;
    }
    for n in 2..10_000 {
        let cand = parent.join(format!("{base}-{n}"));
        if !cand.exists() {
            return cand;
        }
    }
    parent.join(format!("{base}-{}", uuid::Uuid::new_v4()))
}

pub fn zeus_chats_dir(data_root: &Path) -> PathBuf {
    data_root.join(ATHENA_CHATS_DIR)
}

pub fn thread_json_path(dir: &Path, thread_id: &str) -> PathBuf {
    dir.join(format!("{thread_id}.json"))
}

fn thread_from_row(r: &Row<'_>) -> rusqlite::Result<Thread> {
    Ok(Thread {
        id: r.get(0)?,
        title: r.get(1)?,
        model_id: r.get(2)?,
        created_at: r.get(3)?,
        updated_at: r.get(4)?,
        pinned: r.get::<_, i64>(5)? != 0,
        project_id: r.get(6)?,
        color: r.get(7)?,
    })
}

fn load_thread(conn: &Connection, thread_id: &str) -> Result<Thread, String> {
    conn.query_row(
        "SELECT id, title, model_id, created_at, updated_at, pinned, project_id, color FROM threads WHERE id = ?1",
        [thread_id],
        thread_from_row,
    )
    .map_err(|e| e.to_string())
}

fn load_messages(conn: &Connection, thread_id: &str) -> Result<Vec<Message>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, thread_id, role, content, model_id, tokens_used, created_at FROM messages WHERE thread_id = ?1 ORDER BY created_at ASC, rowid ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([thread_id], |r| {
            Ok(Message {
                id: r.get(0)?,
                thread_id: r.get(1)?,
                role: r.get(2)?,
                content: r.get(3)?,
                model_id: r.get(4)?,
                tokens_used: r.get(5)?,
                created_at: r.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

fn project_folder_path(conn: &Connection, project_id: &str) -> Result<Option<PathBuf>, String> {
    let path: String = conn
        .query_row(
            "SELECT COALESCE(folder_path, '') FROM projects WHERE id = ?1",
            [project_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let t = path.trim();
    if t.is_empty() {
        Ok(None)
    } else {
        Ok(Some(PathBuf::from(t)))
    }
}

fn build_thread_json(thread: &Thread, messages: &[Message]) -> Result<String, String> {
    let payload = json!({
        "exportedAt": Utc::now().to_rfc3339(),
        "threadId": thread.id,
        "threadTitle": thread.title,
        "projectId": thread.project_id,
        "createdAt": thread.created_at,
        "updatedAt": thread.updated_at,
        "messages": messages.iter().map(|m| json!({
            "id": m.id,
            "role": m.role,
            "createdAt": m.created_at,
            "modelId": m.model_id,
            "tokensUsed": m.tokens_used,
            "content": m.content,
        })).collect::<Vec<_>>(),
    });
    serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())
}

fn write_file(path: &Path, body: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create {}: {e}", parent.display()))?;
    }
    fs::write(path, body.as_bytes()).map_err(|e| format!("write {}: {e}", path.display()))
}

fn remove_file_if_exists(path: &Path) {
    if path.is_file() {
        let _ = fs::remove_file(path);
    }
}

/// Write `~/.zeus/chats/{thread_id}.json` and, when assigned, a copy under the project folder.
pub fn write_thread_snapshot(conn: &Connection, thread_id: &str) -> Result<(), String> {
    write_thread_snapshot_after_move(conn, thread_id, None)
}

/// Persist thread JSON; when `previous_project_id` is set, remove the stale project-folder copy.
pub fn write_thread_snapshot_after_move(
    conn: &Connection,
    thread_id: &str,
    previous_project_id: Option<&str>,
) -> Result<(), String> {
    let thread = load_thread(conn, thread_id)?;
    let messages = load_messages(conn, thread_id)?;
    let body = build_thread_json(&thread, &messages)?;

    let settings = db::load_settings(conn).map_err(|e| e.to_string())?;
    let data_root = db::resolve_data_dir(&settings);
    let zeus_dir = zeus_chats_dir(&data_root);
    write_file(&thread_json_path(&zeus_dir, thread_id), &body)?;

    if let Some(old_pid) = previous_project_id {
        if thread.project_id.as_deref() != Some(old_pid) {
            if let Ok(Some(folder)) = project_folder_path(conn, old_pid) {
                remove_file_if_exists(&thread_json_path(
                    &folder.join(PROJECT_CHATS_SUBDIR),
                    thread_id,
                ));
            }
        }
    }

    if let Some(ref pid) = thread.project_id {
        if let Some(folder) = project_folder_path(conn, pid)? {
            let proj_chats = folder.join(PROJECT_CHATS_SUBDIR);
            write_file(&thread_json_path(&proj_chats, thread_id), &body)?;
        }
    }

    Ok(())
}

/// Remove on-disk copies for a thread (Zeus `chats/` and optional project `chats/`).
pub fn delete_thread_files(conn: &Connection, thread_id: &str) -> Result<(), String> {
    let settings = db::load_settings(conn).map_err(|e| e.to_string())?;
    let data_root = db::resolve_data_dir(&settings);
    remove_file_if_exists(&thread_json_path(&zeus_chats_dir(&data_root), thread_id));

    let project_id = conn
        .query_row(
            "SELECT project_id FROM threads WHERE id = ?1",
            [thread_id],
            |r| r.get::<_, Option<String>>(0),
        )
        .ok()
        .flatten();
    if let Some(pid) = project_id {
        if let Some(folder) = project_folder_path(conn, &pid)? {
            remove_file_if_exists(&thread_json_path(
                &folder.join(PROJECT_CHATS_SUBDIR),
                thread_id,
            ));
        }
    }
    Ok(())
}

/// Delete every file in `~/.zeus/chats/` (used when clearing all conversations).
pub fn clear_zeus_chats_dir(conn: &Connection) -> Result<(), String> {
    let settings = db::load_settings(conn).map_err(|e| e.to_string())?;
    let dir = zeus_chats_dir(&db::resolve_data_dir(&settings));
    if !dir.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() {
            let _ = fs::remove_file(path);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_strips_invalid_chars() {
        assert_eq!(sanitize_fs_name("My Project: Notes"), "My Project- Notes");
        assert_eq!(sanitize_fs_name("  "), "untitled");
    }
}
