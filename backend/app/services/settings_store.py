"""Thin helpers for reading/writing individual entries in the settings table."""

import sqlite3


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

