"""Session and lock management for chat reply streaming (M1.3b)."""

import asyncio
import json
from typing import Any
from app.errors import ChatBrainException, ValidationException
from app.services.chat import chat_store

_active_conversations: set[str] = set()
_active_lock = asyncio.Lock()


def sse_event(event_name: str, data: dict[str, Any]) -> str:
    """Format Server-Sent Event (SSE) block."""
    return f"event: {event_name}\ndata: {json.dumps(data)}\n\n"


async def acquire_stream_lock(conv_id: str) -> None:
    """Acquire single-stream lock per conversation; raises 409 if already active."""
    async with _active_lock:
        if conv_id in _active_conversations:
            raise ChatBrainException(
                category="conflict",
                message="A reply is already streaming for this conversation. Please wait for it to finish.",
                status_code=409,
            )
        _active_conversations.add(conv_id)


async def release_stream_lock(conv_id: str) -> None:
    """Release single-stream lock per conversation."""
    async with _active_lock:
        _active_conversations.discard(conv_id)


def prepare_reply_session(
    conn: Any,
    conv_id: str,
    content: str | None,
    regenerate: bool,
) -> str:
    """Handle message addition or regeneration logic; returns user_message_id."""
    clean_content = content.strip() if content else None

    if clean_content:
        user_msg = chat_store.add_user_message(conn, conv_id, clean_content)
        return str(user_msg["id"])

    conv = chat_store.get_conversation(conn, conv_id)
    if not conv or not conv["messages"]:
        raise ValidationException(
            "Cannot reply without content in an empty conversation",
            status_code=422,
        )

    last_msg = conv["messages"][-1]

    if regenerate:
        if last_msg["role"] == "assistant":
            conn.execute("DELETE FROM messages WHERE id = ?;", (last_msg["id"],))
            conn.commit()
            conv = chat_store.get_conversation(conn, conv_id)
            if not conv or not conv["messages"]:
                raise ValidationException("No user message to regenerate", status_code=422)
            last_msg = conv["messages"][-1]

        if last_msg["role"] != "user":
            raise ValidationException(
                "Last message must be a user message to regenerate",
                status_code=422,
            )
        return str(last_msg["id"])

    if last_msg["role"] != "user":
        raise ValidationException(
            "Cannot reply without content when last message is not from user",
            status_code=422,
        )
    return str(last_msg["id"])
