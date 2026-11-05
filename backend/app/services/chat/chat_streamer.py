"""SSE streaming coordinator for Chat replies (M1.3b)."""

import asyncio
from collections.abc import AsyncIterator
from datetime import datetime, timezone
import logging
import time
from typing import Any
from fastapi import Request
from app.db.database import create_connection
from app.errors import ProviderException
from app.services.ai.error_classifier import classify_provider_error
from app.services.ai.provider import StreamChunk, get_ai_provider
from app.services.chat import chat_store
from app.services.chat.chat_context import build_chat_context
from app.services.chat.chat_stream_session import (
    StreamLockOwner,
    _active_conversations,
    _active_locks,
    acquire_stream_lock,
    prepare_reply_session,
    release_stream_lock,
    sse_event,
)
from app.services.chat.prompts import SYSTEM_PROMPT
from app.services.default_model import get_default_chat_model_status
from app.services.key_store import load_gemini_key

logger = logging.getLogger("chatbrain.chat.streamer")

FIRST_CHUNK_TIMEOUT_SECONDS = 30.0
IDLE_CHUNK_TIMEOUT_SECONDS = 60.0
PERSISTENCE_INTERVAL_SECONDS = 0.300
PING_INTERVAL_SECONDS = 15.0


async def _is_client_disconnected(request: Request) -> bool:
    """Safe check for client disconnect without failing on mock requests."""
    try:
        return await request.is_disconnected()
    except Exception:
        return False


def _finalize_assistant_msg(
    conn: Any,
    msg_id: str,
    text: str,
    status: str,
    model_id: str | None,
    error_code: str | None = None,
) -> None:
    """Helper to persist finalized assistant message status and attempt metadata."""
    now_iso = datetime.now(timezone.utc).isoformat()
    outcome = "success" if status == "done" else status
    attempts = [{"model_id": model_id, "outcome": outcome, "code": error_code, "at": now_iso}]
    chat_store.update_assistant_message(
        conn,
        msg_id,
        content=text,
        status=status,
        model_used=model_id,
        error_category=error_code,
        attempts=attempts,
    )


async def stream_reply_events(
    conv_id: str,
    user_msg_id: str,
    request: Request,
    owner: StreamLockOwner | None = None,
) -> AsyncIterator[str]:
    """Execute streaming generator emitting SSE events and persisting chunks."""
    if owner is None:
        owner = _active_locks.get(conv_id)
    if owner is not None and owner.task is None:
        try:
            owner.task = asyncio.current_task()
        except RuntimeError:
            pass

    conn = create_connection()
    asst_msg_id: str | None = None
    model_id: str | None = None
    full_text = ""
    message_finalized = False
    stream_iter: AsyncIterator[StreamChunk] | None = None
    chunk_task: asyncio.Task[StreamChunk] | None = None

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

        model_status = get_default_chat_model_status(conn, key_configured=True)
        if not model_status.get("valid") or not model_status.get("model_id"):
            yield sse_event("error", {
                "category": "model",
                "code": "bad_request",
                "message": "Choose a default chat model on the Models page",
                "retryable": False,
                "message_id": None,
            })
            return

        model_id = model_status["model_id"]
        asst_msg = chat_store.create_assistant_message(conn, conv_id)
        asst_msg_id = asst_msg["id"]
        yield sse_event("message_created", {
            "user_message_id": user_msg_id,
            "assistant_message_id": asst_msg_id,
        })
        yield sse_event("status", {"phase": "preparing", "model_id": model_id, "text": "Preparing your message"})

        conv = chat_store.get_conversation(conn, conv_id)
        context = build_chat_context(conv["messages"] if conv else [])

        yield sse_event("status", {"phase": "connecting", "model_id": model_id, "text": f"Connecting to {model_id}"})
        provider = get_ai_provider()
        stream_iter = aiter(provider.stream_chat(
            api_key=api_key,
            model_id=model_id,
            messages=context,
            system_instruction=SYSTEM_PROMPT,
        ))
        yield sse_event("status", {
            "phase": "waiting_first_token",
            "model_id": model_id,
            "text": "Waiting for the first words",
        })

        is_first = True
        last_save_mono = time.monotonic()

        while True:
            if await _is_client_disconnected(request):
                raise asyncio.CancelledError("Client disconnected")

            timeout = FIRST_CHUNK_TIMEOUT_SECONDS if is_first else IDLE_CHUNK_TIMEOUT_SECONDS
            start_wait = time.monotonic()
            chunk_task = asyncio.create_task(stream_iter.__anext__())
            chunk: StreamChunk | None = None

            try:
                while True:
                    elapsed = time.monotonic() - start_wait
                    remaining = timeout - elapsed
                    if remaining <= 0:
                        chunk_task.cancel()
                        raise TimeoutError("Model streaming timed out")

                    step_timeout = min(remaining, PING_INTERVAL_SECONDS)
                    done, _ = await asyncio.wait([chunk_task], timeout=step_timeout)
                    if chunk_task in done:
                        chunk = chunk_task.result()
                        break

                    if await _is_client_disconnected(request):
                        chunk_task.cancel()
                        raise asyncio.CancelledError("Client disconnected")
                    yield ": ping\n\n"
            except (asyncio.CancelledError, GeneratorExit):
                if chunk_task and not chunk_task.done():
                    chunk_task.cancel()
                raise

            if is_first:
                is_first = False
                yield sse_event("status", {"phase": "writing", "model_id": model_id, "text": "Writing the answer"})

            if chunk.finish_reason == "SAFETY":
                raise ProviderException(
                    "The response was blocked by safety filters.",
                    code="safety_blocked",
                    retryable=False,
                )

            if chunk.text:
                full_text += chunk.text
                yield sse_event("delta", {"text": chunk.text})

                now_mono = time.monotonic()
                if now_mono - last_save_mono >= PERSISTENCE_INTERVAL_SECONDS:
                    conn.execute("UPDATE messages SET content = ? WHERE id = ?;", (full_text, asst_msg_id))
                    conn.commit()
                    last_save_mono = now_mono

    except StopAsyncIteration:
        if asst_msg_id and not message_finalized:
            message_finalized = True
            _finalize_assistant_msg(conn, asst_msg_id, full_text, "done", model_id)
            yield sse_event("done", {"message_id": asst_msg_id, "status": "done", "model_used": model_id})

    except GeneratorExit:
        if asst_msg_id and not message_finalized:
            message_finalized = True
            _finalize_assistant_msg(conn, asst_msg_id, full_text, "stopped", model_id, "stopped")
        raise

    except asyncio.CancelledError:
        if asst_msg_id and not message_finalized:
            message_finalized = True
            _finalize_assistant_msg(conn, asst_msg_id, full_text, "stopped", model_id, "stopped")
        try:
            yield sse_event("stopped", {"message_id": asst_msg_id})
        except (GeneratorExit, RuntimeError):
            pass

    except Exception as exc:
        if asst_msg_id and not message_finalized:
            message_finalized = True
            classified = classify_provider_error(exc)
            _finalize_assistant_msg(conn, asst_msg_id, full_text, "error", model_id, classified.code)
            yield sse_event("error", {
                "category": "provider",
                "code": classified.code,
                "message": classified.message,
                "retryable": classified.retryable,
                "message_id": asst_msg_id,
            })

    finally:
        if asst_msg_id and not message_finalized:
            message_finalized = True
            try:
                _finalize_assistant_msg(conn, asst_msg_id, full_text, "stopped", model_id, "stopped")
            except Exception:
                pass

        release_stream_lock(conv_id, owner)

        if chunk_task and not chunk_task.done():
            chunk_task.cancel()

        if stream_iter is not None and hasattr(stream_iter, "aclose"):
            try:
                await asyncio.shield(stream_iter.aclose())
            except Exception:
                pass

        try:
            conn.close()
        except Exception:
            pass
