"""Chat store service: SQLite conversations and messages persistence."""

from datetime import datetime, timezone
import logging
import sqlite3
from typing import Any
import uuid
from app.errors import NotFoundException, ValidationException
from app.services.chat.chat_assistant import (
    create_assistant_message as _create_asst_msg,
    update_assistant_message,
)
from app.services.chat.chat_helpers import decode_cursor, encode_cursor, safe_json_loads
from app.services.chat.chat_lifecycle import (
    clear_all_conversations,
    delete_conversation,
    purge_old_soft_deleted_conversations,
    recover_interrupted_messages,
    restore_conversation as _restore_conv_fn,
    restore_many_conversations,
)
from app.services.chat.chat_markdown import escape_like, strip_markdown
from app.services.chat.chat_messages import add_user_message, edit_user_message

logger = logging.getLogger("chatbrain.chat.store")

__all__ = [
    "add_user_message",
    "clear_all_conversations",
    "create_assistant_message",
    "create_conversation",
    "delete_conversation",
    "edit_user_message",
    "get_conversation",
    "list_conversations",
    "purge_old_soft_deleted_conversations",
    "recover_interrupted_messages",
    "restore_conversation",
    "restore_many_conversations",
    "update_assistant_message",
    "update_conversation",
]


def create_conversation(conn: sqlite3.Connection, title: str | None = None) -> dict[str, Any]:
    """Create a new conversation. Empty/whitespace title rejected; default 'New chat'."""
    clean_title = "New chat"
    title_source = "auto"
    if title is not None:
        trimmed = title.strip()
        if not trimmed:
            raise ValidationException("Conversation title cannot be empty", status_code=422)
        if len(trimmed) > 200:
            raise ValidationException("Conversation title cannot exceed 200 characters", status_code=422)
        clean_title = trimmed
        title_source = "manual"

    conv_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """
        INSERT INTO conversations (id, title, title_source, pinned, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, 0, ?, ?, NULL);
        """,
        (conv_id, clean_title, title_source, now, now),
    )
    conn.commit()
    return {
        "id": conv_id,
        "title": clean_title,
        "title_source": title_source,
        "pinned": False,
        "created_at": now,
        "updated_at": now,
        "deleted_at": None,
        "messages": [],
    }


def get_conversation(conn: sqlite3.Connection, conv_id: str) -> dict[str, Any] | None:
    """Retrieve an active conversation with ordered messages. None if missing/soft-deleted."""
    cur = conn.cursor()
    cur.execute(
        "SELECT id, title, title_source, pinned, created_at, updated_at, deleted_at "
        "FROM conversations WHERE id = ? AND deleted_at IS NULL;",
        (conv_id,),
    )
    conv_row = cur.fetchone()
    if not conv_row:
        return None

    cur.execute(
        "SELECT id, conversation_id, seq, role, content, status, model_used, error_category, "
        "attempts, attachments, created_at, edited_at FROM messages "
        "WHERE conversation_id = ? ORDER BY seq ASC;",
        (conv_id,),
    )
    messages = [
        {
            "id": r["id"],
            "conversation_id": r["conversation_id"],
            "seq": r["seq"],
            "role": r["role"],
            "content": r["content"],
            "status": r["status"],
            "model_used": r["model_used"],
            "error_category": r["error_category"],
            "attempts": safe_json_loads(r["attempts"], "attempts"),
            "attachments": safe_json_loads(r["attachments"], "attachments"),
            "created_at": r["created_at"],
            "edited_at": r["edited_at"],
        }
        for r in cur.fetchall()
    ]

    return {
        "id": conv_row["id"],
        "title": conv_row["title"],
        "title_source": conv_row["title_source"],
        "pinned": bool(conv_row["pinned"]),
        "created_at": conv_row["created_at"],
        "updated_at": conv_row["updated_at"],
        "deleted_at": conv_row["deleted_at"],
        "messages": messages,
    }


def list_conversations(
    conn: sqlite3.Connection,
    search: str | None = None,
    limit: int = 50,
    cursor: str | None = None,
) -> dict[str, Any]:
    """List active conversations ordered by pinned DESC, updated_at DESC, id DESC."""
    limit = max(1, min(100, limit))
    params: list[Any] = []
    where_clauses = ["c.deleted_at IS NULL"]

    if search and search.strip():
        term = f"%{escape_like(search.strip())}%"
        where_clauses.append(
            "(LOWER(c.title) LIKE LOWER(?) ESCAPE '\\' OR EXISTS ("
            "SELECT 1 FROM messages m_s WHERE m_s.conversation_id = c.id "
            "AND LOWER(m_s.content) LIKE LOWER(?) ESCAPE '\\'))"
        )
        params.extend([term, term])

    if cursor:
        c_pinned, c_updated_at, c_id = decode_cursor(cursor)
        where_clauses.append(
            "((c.pinned < ?) OR (c.pinned = ? AND c.updated_at < ?) "
            "OR (c.pinned = ? AND c.updated_at = ? AND c.id < ?))"
        )
        params.extend([c_pinned, c_pinned, c_updated_at, c_pinned, c_updated_at, c_id])

    params.append(limit + 1)
    sql = (
        "SELECT c.id, c.title, c.pinned, c.created_at, c.updated_at, "
        "(SELECT COUNT(1) FROM messages m WHERE m.conversation_id = c.id) AS message_count, "
        "(SELECT m2.content FROM messages m2 WHERE m2.conversation_id = c.id ORDER BY m2.seq DESC LIMIT 1) AS last_content "
        f"FROM conversations c WHERE {' AND '.join(where_clauses)} "
        "ORDER BY c.pinned DESC, c.updated_at DESC, c.id DESC LIMIT ?;"
    )
    cur = conn.cursor()
    cur.execute(sql, params)
    rows = cur.fetchall()

    next_cursor = None
    if len(rows) > limit:
        last = rows[limit - 1]
        next_cursor = encode_cursor(last["pinned"], last["updated_at"], last["id"])
        rows = rows[:limit]

    items = [
        {
            "id": r["id"],
            "title": r["title"],
            "pinned": bool(r["pinned"]),
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
            "message_count": r["message_count"],
            "preview": strip_markdown(r["last_content"] or ""),
        }
        for r in rows
    ]
    return {"items": items, "next_cursor": next_cursor}


def update_conversation(
    conn: sqlite3.Connection,
    conv_id: str,
    title: str | None = None,
    pinned: bool | None = None,
) -> dict[str, Any]:
    """Rename or pin conversation. NEVER modifies updated_at."""
    conv = get_conversation(conn, conv_id)
    if not conv:
        raise NotFoundException("Conversation not found")

    updates: list[str] = []
    params: list[Any] = []
    if title is not None:
        trimmed = title.strip()
        if not trimmed:
            raise ValidationException("Conversation title cannot be empty", status_code=422)
        if len(trimmed) > 200:
            raise ValidationException("Conversation title cannot exceed 200 characters", status_code=422)
        updates.extend(["title = ?", "title_source = 'manual'"])
        params.append(trimmed)

    if pinned is not None:
        updates.append("pinned = ?")
        params.append(1 if pinned else 0)

    if updates:
        params.append(conv_id)
        conn.execute(f"UPDATE conversations SET {', '.join(updates)} WHERE id = ?;", params)
        conn.commit()

    return get_conversation(conn, conv_id)  # type: ignore[return-value]


def create_assistant_message(conn: sqlite3.Connection, conv_id: str) -> dict[str, Any]:
    """Internal M1.3b: Create streaming assistant message (does not change updated_at)."""
    return _create_asst_msg(conn, conv_id, get_conversation)


def restore_conversation(conn: sqlite3.Connection, conv_id: str) -> dict[str, Any]:
    """Restore soft-deleted conversation preserving created_at, updated_at, and pinned."""
    return _restore_conv_fn(conn, conv_id, get_conversation)
