"""Persistence helpers for failover events (M1.3c)."""

from datetime import datetime, timezone
import sqlite3


def record_failover_event(
    conn: sqlite3.Connection,
    conversation_id: str,
    message_id: str,
    from_model: str,
    to_model: str | None,
    code: str,
    round_num: int,
    at: str | None = None,
) -> None:
    """Record a model switch/failover transition into the database."""
    now_iso = at or datetime.now(timezone.utc).isoformat()
    conn.execute(
        """
        INSERT INTO failover_events (
            conversation_id, message_id, from_model, to_model, code, round, at
        ) VALUES (?, ?, ?, ?, ?, ?, ?);
        """,
        (conversation_id, message_id, from_model, to_model, code, round_num, now_iso),
    )
    conn.commit()


def get_failover_events(
    conn: sqlite3.Connection,
    conversation_id: str,
) -> list[dict[str, object]]:
    """Retrieve failover events for a given conversation."""
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, conversation_id, message_id, from_model, to_model, code, round, at
        FROM failover_events
        WHERE conversation_id = ?
        ORDER BY id ASC;
        """,
        (conversation_id,),
    )
    return [dict(row) for row in cursor.fetchall()]
