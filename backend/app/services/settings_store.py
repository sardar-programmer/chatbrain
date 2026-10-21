"""Thin helpers for reading/writing individual entries in the settings table."""

import sqlite3
from datetime import datetime, timezone


def get_setting(conn: sqlite3.Connection, key: str) -> str | None:
    """Read a single setting value or return None if missing."""
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = ?;", (key,))
    row = cursor.fetchone()
    return row["value"] if row else None


def put_setting(conn: sqlite3.Connection, key: str, value: str) -> None:
    """Upsert a single setting value."""
    conn.execute(
        """
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value;
        """,
        (key, value),
    )
    conn.commit()


def delete_setting(conn: sqlite3.Connection, key: str) -> None:
    """Remove a setting entry if it exists."""
    conn.execute("DELETE FROM settings WHERE key = ?;", (key,))
    conn.commit()


SETTING_DEFAULT_CHAT_MODEL = "default_chat_model"
SETTING_LAST_PROVIDER_SUCCESS_AT = "last_provider_success_at"
SETTING_LAST_PROVIDER_ERROR_CATEGORY = "last_provider_error_category"
SETTING_LAST_PROVIDER_ERROR_AT = "last_provider_error_at"


def record_provider_success(conn: sqlite3.Connection) -> None:
    """Record timestamp of last successful provider call."""
    now = datetime.now(timezone.utc).isoformat()
    put_setting(conn, SETTING_LAST_PROVIDER_SUCCESS_AT, now)


def record_provider_error(conn: sqlite3.Connection, category: str) -> None:
    """Record category + timestamp of last provider error. Never stores message text."""
    now = datetime.now(timezone.utc).isoformat()
    put_setting(conn, SETTING_LAST_PROVIDER_ERROR_CATEGORY, category)
    put_setting(conn, SETTING_LAST_PROVIDER_ERROR_AT, now)
