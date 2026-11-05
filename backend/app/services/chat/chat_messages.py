"""User message persistence: adding and editing messages."""

from datetime import datetime, timezone
import json
import re
import sqlite3
from typing import Any
import uuid
from app.errors import NotFoundException, ValidationException
from app.services.chat.chat_helpers import safe_json_loads


def add_user_message(
    conn: sqlite3.Connection,
    conv_id: str,
    content: str,
    attachments: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Add user message, updates conversation.updated_at, and sets auto-title if first message."""
    cur = conn.cursor()
    cur.execute("SELECT id, title_source FROM conversations WHERE id = ? AND deleted_at IS NULL;", (conv_id,))
    conv = cur.fetchone()
    if not conv:
        raise NotFoundException("Conversation not found")

    trimmed = content.strip()
    if not trimmed:
        raise ValidationException("Message content cannot be empty", status_code=422)
    if len(content) > 100000:
        raise ValidationException("Message content exceeds 100,000 characters limit", status_code=422)

    cur.execute("SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM messages WHERE conversation_id = ?;", (conv_id,))
    seq = cur.fetchone()["next_seq"]
    cur.execute("SELECT COUNT(1) AS user_count FROM messages WHERE conversation_id = ? AND role = 'user';", (conv_id,))
    prior_user_count = cur.fetchone()["user_count"]

    msg_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    att_json = json.dumps(attachments) if attachments else None

    conn.execute(
        "INSERT INTO messages (id, conversation_id, seq, role, content, status, attachments, created_at) "
        "VALUES (?, ?, ?, 'user', ?, 'done', ?, ?);",
        (msg_id, conv_id, seq, content, att_json, now),
    )

    if conv["title_source"] == "auto" and prior_user_count == 0:
        auto_title = re.sub(r"\s+", " ", content).strip()[:40].strip()
        if auto_title:
            conn.execute("UPDATE conversations SET updated_at = ?, title = ? WHERE id = ?;", (now, auto_title, conv_id))
        else:
            conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?;", (now, conv_id))
    else:
        conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?;", (now, conv_id))
    conn.commit()

    return {
        "id": msg_id,
        "conversation_id": conv_id,
        "seq": seq,
        "role": "user",
        "content": content,
        "status": "done",
        "model_used": None,
        "error_category": None,
        "attempts": None,
        "attachments": attachments,
        "created_at": now,
        "edited_at": None,
    }


def edit_user_message(conn: sqlite3.Connection, msg_id: str, content: str) -> tuple[dict[str, Any], int]:
    """Edit user message, deleting later messages and updating conversation.updated_at."""
    cur = conn.cursor()
    cur.execute(
        "SELECT id, conversation_id, seq, role, attachments, created_at FROM messages WHERE id = ?;",
        (msg_id,),
    )
    msg = cur.fetchone()
    if not msg:
        raise NotFoundException("Message not found")
    if msg["role"] != "user":
        raise ValidationException("Only user messages can be edited", status_code=422)

    trimmed = content.strip()
    if not trimmed:
        raise ValidationException("Message content cannot be empty", status_code=422)
    if len(content) > 100000:
        raise ValidationException("Message content exceeds 100,000 characters limit", status_code=422)

    now = datetime.now(timezone.utc).isoformat()
    del_cur = conn.execute(
        "DELETE FROM messages WHERE conversation_id = ? AND seq > ?;",
        (msg["conversation_id"], msg["seq"]),
    )
    removed_count = del_cur.rowcount

    conn.execute("UPDATE messages SET content = ?, edited_at = ? WHERE id = ?;", (content, now, msg_id))
    conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?;", (now, msg["conversation_id"]))
    conn.commit()

    updated_msg = {
        "id": msg_id,
        "conversation_id": msg["conversation_id"],
        "seq": msg["seq"],
        "role": "user",
        "content": content,
        "status": "done",
        "model_used": None,
        "error_category": None,
        "attempts": None,
        "attachments": safe_json_loads(msg["attachments"], "attachments"),
        "created_at": msg["created_at"],
        "edited_at": now,
    }
    return updated_msg, removed_count
