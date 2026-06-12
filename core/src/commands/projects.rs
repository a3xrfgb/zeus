use crate::chat_persist::{self, unique_subdir};
use crate::db::{self, Db};
use crate::types::Project;
use chrono::Utc;
use rusqlite::params;
use rusqlite::Row;
use std::path::PathBuf;
use crate::sidecar::context::AppContext;
use uuid::Uuid;

fn is_hex_color(s: &str) -> bool {
    let t = s.trim();
    let hex = t.strip_prefix('#').unwrap_or(t);
    hex.len() == 6 && hex.chars().all(|c| c.is_ascii_hexdigit())
}

fn normalize_color(s: &str) -> String {
    let t = s.trim();
    if is_hex_color(t) {
        if t.starts_with('#') {
            t.to_ascii_lowercase()
        } else {
            format!("#{}", t.to_ascii_lowercase())
        }
    } else {
        "#7c6af7".into()
    }
}

fn project_from_row(r: &Row<'_>) -> rusqlite::Result<Project> {
    Ok(Project {
        id: r.get(0)?,
        name: r.get(1)?,
        created_at: r.get(2)?,
        color: r.get(3)?,
        folder_path: r.get(4)?,
        starred: r.get::<_, i64>(5)? != 0,
        pinned: r.get::<_, i64>(6)? != 0,
    })
}

const PROJECT_SELECT: &str = "SELECT id, name, created_at, COALESCE(color, '#7c6af7'), COALESCE(folder_path, ''), COALESCE(starred, 0), COALESCE(pinned, 0) FROM projects";

pub fn list_projects(ctx: &AppContext) -> Result<Vec<Project>, String> {
    let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(&format!(
            "{PROJECT_SELECT} ORDER BY pinned DESC, starred DESC, created_at DESC"
        ))
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| project_from_row(r))
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

/// `folder_path`: when `None` or empty, creates `{data_dir}/projects/{id}/` on disk.
pub fn create_project(ctx: &AppContext, 
    name: String,
    color: String,
    folder_path: Option<String>) -> Result<Project, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Project name is required".into());
    }
    let color = normalize_color(&color);

    let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
    let settings = db::load_settings(&conn).map_err(|e| e.to_string())?;
    let data_root = PathBuf::from(&settings.data_dir);

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp();

    let resolved_folder: PathBuf = match folder_path {
        Some(ref p) if !p.trim().is_empty() => {
            let parent = PathBuf::from(p.trim());
            if !parent.is_dir() {
                return Err("Folder path must be an existing directory".into());
            }
            let parent = parent
                .canonicalize()
                .map_err(|e| format!("Could not resolve folder path: {e}"))?;
            let dir = unique_subdir(&parent, &name);
            std::fs::create_dir_all(&dir)
                .map_err(|e| format!("Could not create project folder: {e}"))?;
            dir.canonicalize()
                .map_err(|e| format!("Could not resolve project folder: {e}"))?
        }
        _ => {
            let parent = data_root.join("projects");
            std::fs::create_dir_all(&parent)
                .map_err(|e| format!("Could not create projects directory: {e}"))?;
            let dir = unique_subdir(&parent, &name);
            std::fs::create_dir_all(&dir)
                .map_err(|e| format!("Could not create project folder: {e}"))?;
            dir.canonicalize()
                .map_err(|e| format!("Could not resolve project folder: {e}"))?
        }
    };

    let _ = std::fs::create_dir_all(resolved_folder.join(chat_persist::PROJECT_CHATS_SUBDIR));

    let folder_path_str = resolved_folder.to_string_lossy().to_string();

    conn.execute(
        "INSERT INTO projects (id, name, created_at, color, folder_path, starred, pinned) VALUES (?1, ?2, ?3, ?4, ?5, 0, 0)",
        params![id, name, now, color, folder_path_str])
    .map_err(|e| e.to_string())?;

    Ok(Project {
        id,
        name,
        created_at: now,
        color,
        folder_path: folder_path_str,
        starred: false,
        pinned: false,
    })
}

pub fn update_project(ctx: &AppContext, id: String, name: String) -> Result<Project, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Project name is required".into());
    }
    let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
    let n = conn
        .execute(
            "UPDATE projects SET name = ?1 WHERE id = ?2",
            params![name, id])
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("Project not found".into());
    }
    let mut stmt = conn
        .prepare(&format!("{PROJECT_SELECT} WHERE id = ?1"))
        .map_err(|e| e.to_string())?;
    stmt.query_row([&id], |r| project_from_row(r))
        .map_err(|e| e.to_string())
}

pub fn toggle_project_starred(ctx: &AppContext, id: String) -> Result<Project, String> {
    let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
    let cur: i64 = conn
        .query_row(
            "SELECT COALESCE(starred, 0) FROM projects WHERE id = ?1",
            [&id],
            |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let next = if cur == 0 { 1 } else { 0 };
    let n = conn
        .execute(
            "UPDATE projects SET starred = ?1 WHERE id = ?2",
            params![next, id])
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("Project not found".into());
    }
    let mut stmt = conn
        .prepare(&format!("{PROJECT_SELECT} WHERE id = ?1"))
        .map_err(|e| e.to_string())?;
    stmt.query_row([&id], |r| project_from_row(r))
        .map_err(|e| e.to_string())
}

pub fn toggle_project_pinned(ctx: &AppContext, id: String) -> Result<Project, String> {
    let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
    let cur: i64 = conn
        .query_row(
            "SELECT COALESCE(pinned, 0) FROM projects WHERE id = ?1",
            [&id],
            |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let next = if cur == 0 { 1 } else { 0 };
    let n = conn
        .execute(
            "UPDATE projects SET pinned = ?1 WHERE id = ?2",
            params![next, id])
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("Project not found".into());
    }
    let mut stmt = conn
        .prepare(&format!("{PROJECT_SELECT} WHERE id = ?1"))
        .map_err(|e| e.to_string())?;
    stmt.query_row([&id], |r| project_from_row(r))
        .map_err(|e| e.to_string())
}

pub fn delete_project(ctx: &AppContext, id: String) -> Result<(), String> {
    let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE threads SET project_id = NULL, updated_at = ?1 WHERE project_id = ?2",
        params![Utc::now().timestamp(), id])
    .map_err(|e| e.to_string())?;
    let n = conn
        .execute("DELETE FROM projects WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("Project not found".into());
    }
    Ok(())
}
