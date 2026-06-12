use anyhow::Result;
use rusqlite::Connection;

/// Idempotent migration for tasks & calendar data.
pub fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            priority TEXT NOT NULL DEFAULT 'medium'
                CHECK(priority IN ('low', 'medium', 'high')),
            completed INTEGER NOT NULL DEFAULT 0,
            due_date TEXT,
            due_time TEXT,
            tags TEXT NOT NULL DEFAULT '[]',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            completed_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
        CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
        CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks(updated_at DESC);
        "#)?;
    Ok(())
}
