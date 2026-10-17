"""Lightweight, idempotent SQLite migration runner."""

import logging
from pathlib import Path
import sqlite3
from app.db.database import create_connection

logger = logging.getLogger("chatbrain.migrations")


def get_migrations_dir() -> Path:
    """Return the directory containing SQL migration files."""
    return Path(__file__).resolve().parent / "migrations"


def ensure_migrations_table(conn: sqlite3.Connection) -> None:
    """Ensure the schema_migrations tracking table exists."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    conn.commit()


def get_applied_migrations(conn: sqlite3.Connection) -> set[str]:
    """Retrieve all previously applied migration filenames."""
    cursor = conn.cursor()
    cursor.execute("SELECT version FROM schema_migrations;")
    rows = cursor.fetchall()
    return {row["version"] for row in rows}


def run_migrations(db_path: Path | None = None) -> list[str]:
    """Apply any pending SQL migrations in ascending order. Idempotent."""
    conn = create_connection(db_path)
    applied: list[str] = []
    try:
        ensure_migrations_table(conn)
        existing = get_applied_migrations(conn)

        migrations_dir = get_migrations_dir()
        if not migrations_dir.exists():
            return applied

        sql_files = sorted(migrations_dir.glob("*.sql"))

        for sql_file in sql_files:
            filename = sql_file.name
            if filename in existing:
                continue

            sql_content = sql_file.read_text(encoding="utf-8")
            with conn:
                conn.executescript(sql_content)
                conn.execute(
                    "INSERT INTO schema_migrations (version) VALUES (?);",
                    (filename,),
                )
            applied.append(filename)
            logger.info("Applied migration: %s", filename)

        return applied
    finally:
        conn.close()
