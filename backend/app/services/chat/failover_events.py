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


def get_recent_failover_events(
    conn: sqlite3.Connection,
    limit: int = 20,
) -> list[dict[str, object]]:
    """Retrieve recent failover events (newest first), without conv/msg IDs."""
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT at, from_model, to_model, code, round
        FROM failover_events
        ORDER BY id DESC
        LIMIT ?;
        """,
        (limit,),
    )
    return [dict(row) for row in cursor.fetchall()]


def get_failover_count_24h(conn: sqlite3.Connection) -> int:
    """Count failover events occurred in the last 24 hours."""
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT COUNT(*) as cnt FROM failover_events WHERE at >= ?;",
        (cutoff,),
    )
    row = cursor.fetchone()
    return int(row["cnt"]) if row else 0
