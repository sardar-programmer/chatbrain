"""Chat lifecycle: soft delete, restore, clear, purge, and interruption recovery."""

from datetime import datetime, timedelta, timezone
import sqlite3
from typing import Any
from app.errors import NotFoundException


def recover_interrupted_messages(conn: sqlite3.Connection) -> int:
    """Recover messages interrupted in 'streaming' or 'sending' status to 'stopped'."""
    cur = conn.execute(
        "UPDATE messages SET status = 'stopped' WHERE status IN ('streaming', 'sending');"
    )
    return cur.rowcount


def delete_conversation(conn: sqlite3.Connection, conv_id: str) -> dict[str, str]:
    """Soft delete conversation; sets deleted_at."""
    cur = conn.cursor()
    cur.execute("SELECT id FROM conversations WHERE id = ? AND deleted_at IS NULL;", (conv_id,))
    if not cur.fetchone():
        raise NotFoundException("Conversation not found")
    now = datetime.now(timezone.utc).isoformat()
    conn.execute("UPDATE conversations SET deleted_at = ? WHERE id = ?;", (now, conv_id))
    return {"id": conv_id, "deleted_at": now}


def restore_conversation(
    conn: sqlite3.Connection,
    conv_id: str,
    get_fn: Any,
) -> dict[str, Any]:
    """Restore soft-deleted conversation preserving created_at, updated_at, and pinned."""
    cur = conn.cursor()
    cur.execute("SELECT id FROM conversations WHERE id = ?;", (conv_id,))
    if not cur.fetchone():
        raise NotFoundException("Conversation not found")
    conn.execute("UPDATE conversations SET deleted_at = NULL WHERE id = ?;", (conv_id,))
    return get_fn(conn, conv_id)


def clear_all_conversations(conn: sqlite3.Connection) -> list[str]:
    """Soft delete all non-deleted conversations."""
    cur = conn.cursor()
    cur.execute("SELECT id FROM conversations WHERE deleted_at IS NULL;")
    ids = [r["id"] for r in cur.fetchall()]
    if ids:
        now = datetime.now(timezone.utc).isoformat()
        conn.execute("UPDATE conversations SET deleted_at = ? WHERE deleted_at IS NULL;", (now,))
    return ids


def restore_many_conversations(conn: sqlite3.Connection, ids: list[str]) -> list[str]:
    """Restore multiple soft-deleted conversations by ID."""
    if not ids:
        return []
    placeholders = ",".join("?" for _ in ids)
    cur = conn.cursor()
    cur.execute(
        f"SELECT id FROM conversations WHERE id IN ({placeholders}) AND deleted_at IS NOT NULL;",
        ids,
    )
    matching_ids = [r["id"] for r in cur.fetchall()]
    if matching_ids:
        in_sql = ",".join("?" for _ in matching_ids)
        conn.execute(f"UPDATE conversations SET deleted_at = NULL WHERE id IN ({in_sql});", matching_ids)
    return matching_ids


def purge_old_soft_deleted_conversations(conn: sqlite3.Connection, days: int = 7) -> int:
    """Permanently delete conversations soft-deleted more than `days` ago (messages cascade)."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    cur = conn.execute(
        "DELETE FROM conversations WHERE deleted_at IS NOT NULL AND deleted_at < ?;",
        (cutoff,),
    )
    return cur.rowcount
