"""SQLite database connection management."""

from collections.abc import Generator
from pathlib import Path
import sqlite3
from app.config import get_settings


def get_db_path() -> Path:
    """Return the resolved database path."""
    return get_settings().get_resolved_db_path()


def create_connection(db_path: Path | None = None) -> sqlite3.Connection:
    """Create and configure a new SQLite connection."""
    target_path = db_path or get_db_path()
    conn = sqlite3.connect(
        str(target_path),
        timeout=15.0,
        check_same_thread=False,
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def get_db() -> Generator[sqlite3.Connection, None, None]:
    """FastAPI dependency for database connection."""
    conn = create_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def check_db_health() -> bool:
    """Verify SQLite database connectivity."""
    try:
        conn = create_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT 1;")
            result = cursor.fetchone()
            return bool(result and result[0] == 1)
        finally:
            conn.close()
    except Exception:
        return False
