mod schema;

use crate::types::AppSettings;
use anyhow::{Context, Result};
use rusqlite::Connection;
use serde_json;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

pub struct Db(pub Arc<Mutex<Connection>>);

pub fn default_db_path(data_dir: impl AsRef<std::path::Path>) -> PathBuf {
    let dir = data_dir.as_ref();
    let modern = dir.join("zeus.db");
    let legacy = dir.join("athena.db");
    if !modern.is_file() && legacy.is_file() {
        let _ = std::fs::rename(&legacy, &modern);
    }
    modern
}

/// Resolve Zeus data root: settings → `ZEUS_DATA_DIR` → `~/.zeus`.
pub fn resolve_data_dir(settings: &AppSettings) -> PathBuf {
    let trimmed = settings.data_dir.trim();
    if !trimmed.is_empty() {
        return PathBuf::from(trimmed);
    }
    if let Ok(dir) = std::env::var("ZEUS_DATA_DIR") {
        let p = PathBuf::from(dir.trim());
        if !p.as_os_str().is_empty() {
            return p;
        }
    }
    dirs::home_dir()
        .map(|h| {
            let legacy = h.join(".athena");
            let modern = h.join(".zeus");
            if legacy.is_dir() && !modern.exists() {
                let _ = std::fs::rename(&legacy, &modern);
            }
            modern
        })
        .unwrap_or_else(|| PathBuf::from(".zeus"))
}

pub fn resolve_data_dir_from_conn(conn: &Connection) -> Result<PathBuf> {
    let settings = load_settings(conn)?;
    Ok(resolve_data_dir(&settings))
}

pub fn resolve_data_dir_from_db(db: &Db) -> Result<PathBuf, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    Ok(resolve_data_dir(&load_settings(&conn).map_err(|e| e.to_string())?))
}

pub fn models_dir_from_db(db: &Db) -> Result<PathBuf, String> {
    let data = resolve_data_dir_from_db(db)?;
    crate::models::manager::ensure_models_dir(&data).map_err(|e| e.to_string())
}

pub fn open(db_path: &PathBuf) -> Result<Connection> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).with_context(|| format!("create {:?}", parent))?;
    }
    let conn = Connection::open(db_path).with_context(|| format!("open {:?}", db_path))?;
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
    for m in schema::MIGRATIONS {
        conn.execute_batch(m)?;
    }
    ensure_schema_extensions(&conn)?;
    crate::tasks::schema::migrate(&conn)?;
    Ok(conn)
}

/// Add columns / tables for existing DBs (idempotent).
fn ensure_schema_extensions(conn: &Connection) -> Result<()> {
    let cols: Vec<String> = {
        let mut stmt = conn.prepare("PRAGMA table_info(threads)")?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(1))?;
        rows.collect::<Result<_, _>>()?
    };
    if !cols.iter().any(|c| c == "pinned") {
        conn.execute(
            "ALTER TABLE threads ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0",
            [])?;
    }
    if !cols.iter().any(|c| c == "project_id") {
        conn.execute("ALTER TABLE threads ADD COLUMN project_id TEXT", [])?;
    }
    if !cols.iter().any(|c| c == "color") {
        conn.execute(
            "ALTER TABLE threads ADD COLUMN color TEXT NOT NULL DEFAULT '#64748b'",
            [])?;
    }
    conn.execute_batch(
        r#"CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );"#)?;
    let prj_cols: Vec<String> = {
        let mut stmt = conn.prepare("PRAGMA table_info(projects)")?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(1))?;
        rows.collect::<Result<_, _>>()?
    };
    if !prj_cols.iter().any(|c| c == "color") {
        conn.execute(
            "ALTER TABLE projects ADD COLUMN color TEXT NOT NULL DEFAULT '#7c6af7'",
            [])?;
    }
    if !prj_cols.iter().any(|c| c == "folder_path") {
        conn.execute(
            "ALTER TABLE projects ADD COLUMN folder_path TEXT NOT NULL DEFAULT ''",
            [])?;
    }
    let prj_cols2: Vec<String> = {
        let mut stmt = conn.prepare("PRAGMA table_info(projects)")?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(1))?;
        rows.collect::<Result<_, _>>()?
    };
    if !prj_cols2.iter().any(|c| c == "starred") {
        conn.execute(
            "ALTER TABLE projects ADD COLUMN starred INTEGER NOT NULL DEFAULT 0",
            [])?;
    }
    let prj_cols3: Vec<String> = {
        let mut stmt = conn.prepare("PRAGMA table_info(projects)")?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(1))?;
        rows.collect::<Result<_, _>>()?
    };
    if !prj_cols3.iter().any(|c| c == "pinned") {
        conn.execute(
            "ALTER TABLE projects ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0",
            [])?;
    }
    Ok(())
}

pub fn load_settings(conn: &Connection) -> Result<AppSettings> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = 'app'")?;
    let row = stmt.query_row([], |r| r.get::<_, String>(0));
    match row {
        Ok(json) => {
            let s: AppSettings = serde_json::from_str(&json)?;
            Ok(s)
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(AppSettings::default()),
        Err(e) => Err(e.into()),
    }
}

pub fn save_settings(conn: &Connection, settings: &AppSettings) -> Result<()> {
    let json = serde_json::to_string(settings)?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('app', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [json])?;
    Ok(())
}

pub fn init_db(conn: &Connection) -> Result<()> {
    let _ = load_settings(conn)?;
    Ok(())
}
