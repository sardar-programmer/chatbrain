"""SSE streaming coordinator for Chat replies with failover (M1.3c)."""

import asyncio
from collections.abc import AsyncIterator
import logging
from typing import Any
from fastapi import Request
from app.db.database import create_connection
from app.services.ai.provider import derive_kind
from app.services.chat import chat_store
from app.services.chat.chat_context import build_chat_context
from app.services.chat.chat_stream_session import (
    StreamLockOwner,
    _active_conversations,
    _active_locks,
    release_stream_lock,
    sse_event,
)
from app.services.chat.failover_runner import execute_failover_reply
from app.services.chat.failover_stream import finalize_assistant_msg
from app.services.default_model import get_default_chat_model_status
from app.services.key_store import load_gemini_key
from app.services.model_registry import get_cached_models

logger = logging.getLogger("chatbrain.chat.streamer")

FIRST_CHUNK_TIMEOUT_SECONDS = 12.0
IDLE_CHUNK_TIMEOUT_SECONDS = 60.0
PERSISTENCE_INTERVAL_SECONDS = 0.300
PING_INTERVAL_SECONDS = 15.0


async def stream_reply_events(
    conv_id: str,
    user_msg_id: str,
    request: Request,
    owner: StreamLockOwner | None = None,
) -> AsyncIterator[str]:
    """Execute streaming generator emitting SSE events with automatic model failover."""
    if owner is None:
        owner = _active_locks.get(conv_id)
    if owner is not None and owner.task is None:
        try:
            owner.task = asyncio.current_task()
        except RuntimeError:
            pass

    conn = create_connection()
    asst_msg_id: str | None = None
    message_finalized = False
    failover_gen: AsyncIterator[str] | None = None

    try:
        api_key = load_gemini_key()
        if not api_key:
            yield sse_event("error", {
                "category": "auth",
                "code": "invalid_key",
                "message": "Add your Gemini API key first",
                "retryable": False,
                "message_id": None,
            })
            return

        all_models = get_cached_models(conn)
        chat_candidates = [
            m for m in all_models
            if derive_kind(m.id, m.supported_actions, m.capabilities).kind == "chat"
        ]
        if not chat_candidates:
            yield sse_event("error", {
                "category": "model",
                "code": "bad_request",
                "message": "No chat model is available yet. Open the Models page and refresh the list.",
                "retryable": False,
                "message_id": None,
            })
            return

        dcm = get_default_chat_model_status(conn, key_configured=True)
        default_model_id = dcm["model_id"] if dcm.get("valid") else None

        asst_msg = chat_store.create_assistant_message(conn, conv_id)
        asst_msg_id = asst_msg["id"]
        yield sse_event("message_created", {
            "user_message_id": user_msg_id,
            "assistant_message_id": asst_msg_id,
        })
        yield sse_event("status", {"phase": "preparing", "text": "Preparing your message"})

        conv = chat_store.get_conversation(conn, conv_id)
        context = build_chat_context(conv["messages"] if conv else [])

        yield sse_event("status", {"phase": "connecting", "text": "Connecting"})
        yield sse_event("status", {"phase": "waiting_first_token", "text": "Waiting for the first words"})

        failover_gen = execute_failover_reply(
            conn=conn,
            conv_id=conv_id,
            asst_msg_id=asst_msg_id,
            api_key=api_key,
            context=context,
            all_models=all_models,
            default_model_id=default_model_id,
            request=request,
        )
        async for event in failover_gen:
            if '"status": "done"' in event or '"category":' in event:
                message_finalized = True
            yield event

    except GeneratorExit:
        if asst_msg_id and not message_finalized:
            message_finalized = True
            finalize_assistant_msg(conn, asst_msg_id, "", "stopped", None, "stopped")
        raise

    except asyncio.CancelledError:
        if asst_msg_id and not message_finalized:
            message_finalized = True
            finalize_assistant_msg(conn, asst_msg_id, "", "stopped", None, "stopped")
        try:
            yield sse_event("stopped", {"message_id": asst_msg_id})
        except (GeneratorExit, RuntimeError):
            pass

    except Exception as exc:
        if asst_msg_id and not message_finalized:
            message_finalized = True
            finalize_assistant_msg(conn, asst_msg_id, "", "error", None, "unknown")
            yield sse_event("error", {
                "category": "internal",
                "code": "unknown",
                "message": "Internal streaming error",
                "retryable": False,
                "message_id": asst_msg_id,
            })
        logger.exception("Unexpected error in chat streaming: %s", exc)

    finally:
        if asst_msg_id and not message_finalized:
            message_finalized = True
            try:
                finalize_assistant_msg(conn, asst_msg_id, "", "stopped", None, "stopped")
            except Exception:
                pass

        if failover_gen is not None and hasattr(failover_gen, "aclose"):
            try:
                await asyncio.shield(failover_gen.aclose())
            except Exception:
                pass

        release_stream_lock(conv_id, owner)

        try:
            conn.close()
        except Exception:
            pass
