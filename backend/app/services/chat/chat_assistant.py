"""Internal assistant message persistence functions for M1.3b."""

from datetime import datetime, timezone
import json
import sqlite3
from typing import Any
import uuid
from app.errors import NotFoundException
from app.services.chat.chat_helpers import safe_json_loads


def create_assistant_message(
    conn: sqlite3.Connection,
    conv_id: str,
    get_conv_fn: Any,
) -> dict[str, Any]:
    """Create streaming assistant message (does not change conversation updated_at)."""
    conv = get_conv_fn(conn, conv_id)
    if not conv:
        raise NotFoundException("Conversation not found")

    cur = conn.cursor()
    cur.execute(
        "SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM messages WHERE conversation_id = ?;",
        (conv_id,),
    )
    seq = cur.fetchone()["next_seq"]
    msg_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    conn.execute(
        "INSERT INTO messages (id, conversation_id, seq, role, content, status, created_at) "
        "VALUES (?, ?, ?, 'assistant', '', 'streaming', ?);",
        (msg_id, conv_id, seq, now),
    )
    conn.commit()
    return {
        "id": msg_id,
        "conversation_id": conv_id,
        "seq": seq,
        "role": "assistant",
        "content": "",
        "status": "streaming",
        "model_used": None,
        "error_category": None,
        "attempts": None,
        "attachments": None,
        "created_at": now,
        "edited_at": None,
    }


def update_assistant_message(
    conn: sqlite3.Connection,
    msg_id: str,
    content: str | None = None,
    status: str | None = None,
    model_used: str | None = None,
    error_category: str | None = None,
    attempts: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Update assistant message; updates updated_at on final status."""
    cur = conn.cursor()
    cur.execute(
        "SELECT id, conversation_id, seq, role, created_at, edited_at FROM messages WHERE id = ?;",
        (msg_id,),
    )
    msg = cur.fetchone()
    if not msg:
        raise NotFoundException("Message not found")

    updates: list[str] = []
    params: list[Any] = []
    if content is not None:
        updates.append("content = ?")
        params.append(content)
    if status is not None:
        updates.append("status = ?")
        params.append(status)
    if model_used is not None:
        updates.append("model_used = ?")
        params.append(model_used)
    if error_category is not None:
        updates.append("error_category = ?")
        params.append(error_category)
    if attempts is not None:
        updates.append("attempts = ?")
        params.append(json.dumps(attempts))

    if updates:
        params.append(msg_id)
        conn.execute(f"UPDATE messages SET {', '.join(updates)} WHERE id = ?;", params)

    if status in ("done", "error", "stopped"):
        now = datetime.now(timezone.utc).isoformat()
        conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?;", (now, msg["conversation_id"]))
    conn.commit()

    cur.execute("SELECT * FROM messages WHERE id = ?;", (msg_id,))
    row = cur.fetchone()
    return {
        "id": row["id"],
        "conversation_id": row["conversation_id"],
        "seq": row["seq"],
        "role": row["role"],
        "content": row["content"],
        "status": row["status"],
        "model_used": row["model_used"],
        "error_category": row["error_category"],
        "attempts": safe_json_loads(row["attempts"], "attempts"),
        "attachments": safe_json_loads(row["attachments"], "attachments"),
        "created_at": row["created_at"],
        "edited_at": row["edited_at"],
    }
