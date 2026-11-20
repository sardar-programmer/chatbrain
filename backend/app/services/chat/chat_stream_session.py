"""Session and lock management for chat reply streaming (M1.3b)."""

import asyncio
from datetime import datetime, timezone
import json
from typing import Any
import uuid
import weakref
from app.errors import ChatBrainException, NotFoundException, ValidationException
from app.services.chat import chat_store


class _SyncAwaitable:
    """Helper enabling synchronous return values to also be awaited."""

    def __init__(self, value: Any = None):
        self.value = value

    def __await__(self):
        if False:
            yield
        return self.value


class StreamLockOwner:
    """Represents the owner of an active streaming reply session."""

    def __init__(
        self,
        token: str | None = None,
        task: asyncio.Task[Any] | None = None,
    ):
        self.token: str = token or uuid.uuid4().hex
        self.is_active: bool = True
        self.task: asyncio.Task[Any] | None = task
        self._generator_ref: weakref.ref[Any] | None = None

    def mark_finished(self) -> None:
        """Mark owner stream as finished/cancelled/closed."""
        self.is_active = False

    def set_generator(self, gen: Any) -> None:
        """Track weak reference to the stream generator."""
        self._generator_ref = weakref.ref(gen)

    def is_running(self) -> bool:
        """Determine if stream is truly still running."""
        if not self.is_active:
            return False
        if self.task is not None and self.task.done():
            return False
        if self._generator_ref is not None:
            gen = self._generator_ref()
            if gen is None:
                return False
            if hasattr(gen, "ag_frame") and gen.ag_frame is None:
                return False
        return True

    def __await__(self):
        if False:
            yield
        return self


_active_conversations: set[str] = set()
_active_locks: dict[str, StreamLockOwner] = {}


def sse_event(event_name: str, data: dict[str, Any]) -> str:
    """Format Server-Sent Event (SSE) block."""
    return f"event: {event_name}\ndata: {json.dumps(data)}\n\n"


def acquire_stream_lock(
    conv_id: str,
    owner: StreamLockOwner | None = None,
) -> StreamLockOwner:
    """Acquire single-stream lock per conversation; raises 409 if already active."""
    existing = _active_locks.get(conv_id)
    if existing is not None:
        if not existing.is_running():
            _active_locks.pop(conv_id, None)
            _active_conversations.discard(conv_id)
        else:
            raise ChatBrainException(
                category="conflict",
                message="A reply is already streaming for this conversation. Please wait for it to finish.",
                status_code=409,
            )
    elif conv_id in _active_conversations:
        raise ChatBrainException(
            category="conflict",
            message="A reply is already streaming for this conversation. Please wait for it to finish.",
            status_code=409,
        )

    lock_owner = owner or StreamLockOwner()
    if lock_owner.task is None:
        try:
            lock_owner.task = asyncio.current_task()
        except RuntimeError:
            pass

    _active_locks[conv_id] = lock_owner
    _active_conversations.add(conv_id)
    return lock_owner


def release_stream_lock(
    conv_id: str,
    owner: StreamLockOwner | str | None = None,
) -> _SyncAwaitable:
    """Release single-stream lock per conversation synchronously."""
    current = _active_locks.get(conv_id)
    if current is not None:
        owner_token = owner.token if isinstance(owner, StreamLockOwner) else owner
        if owner_token is None or current.token == owner_token:
            current.mark_finished()
            _active_locks.pop(conv_id, None)
            _active_conversations.discard(conv_id)
    else:
        _active_conversations.discard(conv_id)
    return _SyncAwaitable(None)


def prepare_reply_session(
    conn: Any,
    conv_id: str,
    content: str | None,
    regenerate: bool,
    regenerate_from: str | None = None,
) -> str:
    """Handle message addition or regeneration logic; returns user_message_id."""
    clean_content = content.strip() if content else None

    if clean_content:
        user_msg = chat_store.add_user_message(conn, conv_id, clean_content)
        return str(user_msg["id"])

    if regenerate_from:
        cur = conn.cursor()
        cur.execute("SELECT id, conversation_id, seq, role FROM messages WHERE id = ?;", (regenerate_from,))
        target_msg = cur.fetchone()
        if not target_msg:
            raise NotFoundException(f"Message {regenerate_from} not found")
        if target_msg["conversation_id"] != conv_id:
            raise ValidationException("Message belongs to another conversation", status_code=422)
        if target_msg["role"] != "assistant":
            raise ValidationException("Can only regenerate from an assistant message", status_code=422)

        cur.execute(
            "SELECT id, role, seq FROM messages WHERE conversation_id = ? AND seq < ? ORDER BY seq DESC LIMIT 1;",
            (conv_id, target_msg["seq"]),
        )
        prev_msg = cur.fetchone()
        if not prev_msg or prev_msg["role"] != "user":
            raise ValidationException("No user message before this assistant message to regenerate", status_code=422)

        now = datetime.now(timezone.utc).isoformat()
        conn.execute("DELETE FROM messages WHERE conversation_id = ? AND seq >= ?;", (conv_id, target_msg["seq"]))
        conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?;", (now, conv_id))
        conn.commit()
        return str(prev_msg["id"])

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
