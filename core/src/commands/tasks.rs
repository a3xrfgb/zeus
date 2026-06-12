use crate::db::Db;
use crate::types::{
    CreateTaskInput, ListTasksFilter, TaskItem, TaskPriority, TaskStats, UpdateTaskInput,
};
use chrono::{Datelike, NaiveDate, Utc};
use rusqlite::params;
use rusqlite::Row;
use serde_json;
use crate::sidecar::context::AppContext;
use uuid::Uuid;

const TASK_SELECT: &str = "SELECT id, title, description, priority, completed, due_date, due_time, tags, created_at, updated_at, completed_at FROM tasks";

fn parse_tags(raw: &str) -> Vec<String> {
    serde_json::from_str(raw).unwrap_or_default()
}

fn tags_to_json(tags: &[String]) -> String {
    let cleaned: Vec<String> = tags
        .iter()
        .map(|t| t.trim())
        .filter(|t| !t.is_empty())
        .map(|t| t.to_string())
        .collect();
    serde_json::to_string(&cleaned).unwrap_or_else(|_| "[]".into())
}

fn task_from_row(r: &Row<'_>) -> rusqlite::Result<TaskItem> {
    let priority_raw: String = r.get(3)?;
    let tags_raw: String = r.get(7)?;
    Ok(TaskItem {
        id: r.get(0)?,
        title: r.get(1)?,
        description: r.get(2)?,
        priority: TaskPriority::from_db(&priority_raw),
        completed: r.get::<_, i64>(4)? != 0,
        due_date: r.get(5)?,
        due_time: r.get(6)?,
        tags: parse_tags(&tags_raw),
        created_at: r.get(8)?,
        updated_at: r.get(9)?,
        completed_at: r.get(10)?,
    })
}

fn validate_iso_date(s: &str) -> Result<(), String> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .map_err(|_| "Invalid due date (YYYY-MM-DD)".to_string())?;
    Ok(())
}

fn validate_time(s: &str) -> Result<(), String> {
    if s.is_empty() {
        return Ok(());
    }
    let parts: Vec<_> = s.split(':').collect();
    if parts.len() != 2 {
        return Err("Invalid due time (HH:mm)".into());
    }
    let h: u32 = parts[0].parse().map_err(|_| "Invalid due time (HH:mm)".to_string())?;
    let m: u32 = parts[1].parse().map_err(|_| "Invalid due time (HH:mm)".to_string())?;
    if h > 23 || m > 59 {
        return Err("Invalid due time (HH:mm)".into());
    }
    Ok(())
}

fn today_iso() -> String {
    let now = Utc::now().date_naive();
    format!("{:04}-{:02}-{:02}", now.year(), now.month(), now.day())
}

fn is_overdue(task: &TaskItem) -> bool {
    if task.completed {
        return false;
    }
    let Some(ref due) = task.due_date else {
        return false;
    };
    due.as_str() < today_iso().as_str()
}

pub fn list_tasks(ctx: &AppContext, filter: Option<ListTasksFilter>) -> Result<Vec<TaskItem>, String> {
    let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
    let f = filter.unwrap_or_default();

    let mut stmt = conn
        .prepare(&format!(
            "{TASK_SELECT} ORDER BY completed ASC, due_date IS NULL, due_date ASC, updated_at DESC"
        ))
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| task_from_row(r))
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }

    if let Some(ref search) = f.search {
        let q = search.trim().to_lowercase();
        if !q.is_empty() {
            out.retain(|t| {
                let hay = format!(
                    "{} {} {}",
                    t.title.to_lowercase(),
                    t.description.to_lowercase(),
                    t.tags.join(" ").to_lowercase()
                );
                hay.contains(&q)
            });
        }
    }
    if let Some(ref priority) = f.priority {
        out.retain(|t| t.priority == *priority);
    }
    if let Some(completed) = f.completed {
        out.retain(|t| t.completed == completed);
    }
    if let Some(ref tag) = f.tag {
        let tg = tag.trim();
        if !tg.is_empty() {
            out.retain(|t| t.tags.iter().any(|x| x == tg));
        }
    }

    Ok(out)
}

pub fn get_task_stats(ctx: &AppContext) -> Result<TaskStats, String> {
    let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
    let total: u32 = conn
        .query_row("SELECT COUNT(*) FROM tasks", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let completed: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM tasks WHERE completed = 1",
            [],
            |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let today = today_iso();
    let overdue: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM tasks WHERE completed = 0 AND due_date IS NOT NULL AND due_date < ?1",
            params![today],
            |r| r.get(0))
        .map_err(|e| e.to_string())?;
    Ok(TaskStats {
        total,
        completed,
        pending: total.saturating_sub(completed),
        overdue,
    })
}

pub fn create_task(ctx: &AppContext, input: CreateTaskInput) -> Result<TaskItem, String> {
    let title = input.title.trim().to_string();
    if title.is_empty() {
        return Err("Task title is required".into());
    }
    if let Some(ref d) = input.due_date {
        validate_iso_date(d)?;
    }
    if let Some(ref t) = input.due_time {
        validate_time(t)?;
    }

    let priority = input.priority.unwrap_or(TaskPriority::Medium);
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().timestamp();
    let tags_json = tags_to_json(&input.tags);

    let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO tasks (id, title, description, priority, completed, due_date, due_time, tags, created_at, updated_at, completed_at)
         VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?7, ?8, ?9, NULL)",
        params![
            id,
            title,
            input.description.trim(),
            priority.as_str(),
            input.due_date,
            input.due_time.filter(|t| !t.trim().is_empty()),
            tags_json,
            now,
            now,
        ])
    .map_err(|e| e.to_string())?;

    fetch_task(&conn, &id)
}

pub fn update_task(ctx: &AppContext, 
    id: String,
    input: UpdateTaskInput) -> Result<TaskItem, String> {
    let title = input.title.trim().to_string();
    if title.is_empty() {
        return Err("Task title is required".into());
    }
    if let Some(ref d) = input.due_date {
        validate_iso_date(d)?;
    }
    if let Some(ref t) = input.due_time {
        validate_time(t)?;
    }

    let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
    let existing = fetch_task(&conn, &id)?;

    let due_date = input.due_date.filter(|d| !d.is_empty());
    let due_time = input.due_time.filter(|t| !t.is_empty());
    let tags_json = tags_to_json(&input.tags);
    let now = Utc::now().timestamp();
    let completed_at = if input.completed && !existing.completed {
        Some(now)
    } else if !input.completed {
        None
    } else {
        existing.completed_at
    };

    let n = conn
        .execute(
            "UPDATE tasks SET title = ?1, description = ?2, priority = ?3, completed = ?4,
             due_date = ?5, due_time = ?6, tags = ?7, updated_at = ?8, completed_at = ?9
             WHERE id = ?10",
            params![
                title,
                input.description.trim(),
                input.priority.as_str(),
                if input.completed { 1 } else { 0 },
                due_date,
                due_time,
                tags_json,
                now,
                completed_at,
                id,
            ])
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("Task not found".into());
    }
    fetch_task(&conn, &id)
}

pub fn delete_task(ctx: &AppContext, id: String) -> Result<(), String> {
    let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
    let n = conn
        .execute("DELETE FROM tasks WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("Task not found".into());
    }
    Ok(())
}

pub fn toggle_task_completed(ctx: &AppContext, id: String) -> Result<TaskItem, String> {
    let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
    let existing = fetch_task(&conn, &id)?;
    let completed = !existing.completed;
    let now = Utc::now().timestamp();
    let completed_at: Option<i64> = if completed { Some(now) } else { None };
    conn.execute(
        "UPDATE tasks SET completed = ?1, completed_at = ?2, updated_at = ?3 WHERE id = ?4",
        params![if completed { 1 } else { 0 }, completed_at, now, id])
    .map_err(|e| e.to_string())?;
    fetch_task(&conn, &id)
}

pub fn move_task_due_date(ctx: &AppContext, 
    id: String,
    due_date: Option<String>) -> Result<TaskItem, String> {
    if let Some(ref d) = due_date {
        validate_iso_date(d)?;
    }
    let conn = ctx.db.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().timestamp();
    let n = conn
        .execute(
            "UPDATE tasks SET due_date = ?1, updated_at = ?2 WHERE id = ?3",
            params![due_date, now, id])
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("Task not found".into());
    }
    fetch_task(&conn, &id)
}

fn fetch_task(conn: &rusqlite::Connection, id: &str) -> Result<TaskItem, String> {
    let mut stmt = conn
        .prepare(&format!("{TASK_SELECT} WHERE id = ?1"))
        .map_err(|e| e.to_string())?;
    stmt.query_row([id], |r| task_from_row(r))
        .map_err(|e| e.to_string())
}

#[allow(dead_code)]
pub fn task_is_overdue(task: &TaskItem) -> bool {
    is_overdue(task)
}
