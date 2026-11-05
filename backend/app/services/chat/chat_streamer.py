"""SSE streaming coordinator for Chat replies (M1.3b)."""

import asyncio
from collections.abc import AsyncIterator
from datetime import datetime, timezone
import logging
import time
from fastapi import Request
from app.db.database import create_connection
from app.errors import ProviderException
from app.services.ai.error_classifier import classify_provider_error
from app.services.ai.provider import StreamChunk, get_ai_provider
from app.services.chat import chat_store
from app.services.chat.chat_context import build_chat_context
from app.services.chat.chat_stream_session import (
    _active_conversations,
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


async def stream_reply_events(
    conv_id: str,
    user_msg_id: str,
    request: Request,
) -> AsyncIterator[str]:
    """Execute streaming generator emitting SSE events and persisting chunks."""
    conn = create_connection()
    asst_msg_id: str | None = None
    model_id: str | None = None
    full_text = ""

    try:
        # 1. Resolve credentials and model BEFORE creating assistant message
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

        # 2. Create assistant message in streaming state
        asst_msg = chat_store.create_assistant_message(conn, conv_id)
        asst_msg_id = asst_msg["id"]
        yield sse_event("message_created", {
            "user_message_id": user_msg_id,
            "assistant_message_id": asst_msg_id,
        })

        # 3. Status: preparing
        yield sse_event("status", {"phase": "preparing", "model_id": model_id, "text": "Preparing your message"})

        conv = chat_store.get_conversation(conn, conv_id)
        context = build_chat_context(conv["messages"] if conv else [])

        # 4. Status: connecting
        yield sse_event("status", {"phase": "connecting", "model_id": model_id, "text": f"Connecting to {model_id}"})

        provider = get_ai_provider()
        stream_iter = aiter(provider.stream_chat(
            api_key=api_key,
            model_id=model_id,
            messages=context,
            system_instruction=SYSTEM_PROMPT,
        ))

        # 5. Status: waiting_first_token
        yield sse_event("status", {
            "phase": "waiting_first_token",
            "model_id": model_id,
            "text": "Waiting for the first words",
        })

        is_first = True
        last_save_mono = time.monotonic()

        while True:
            if await request.is_disconnected():
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

                    if await request.is_disconnected():
                        chunk_task.cancel()
                        raise asyncio.CancelledError("Client disconnected")
                    yield ": ping\n\n"
            except asyncio.CancelledError:
                if not chunk_task.done():
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
        if asst_msg_id:
            now_iso = datetime.now(timezone.utc).isoformat()
            chat_store.update_assistant_message(
                conn,
                asst_msg_id,
                content=full_text,
                status="done",
                model_used=model_id,
                attempts=[{"model_id": model_id, "outcome": "success", "code": None, "at": now_iso}],
            )
            yield sse_event("done", {"message_id": asst_msg_id, "status": "done", "model_used": model_id})

    except asyncio.CancelledError:
        if asst_msg_id:
            now_iso = datetime.now(timezone.utc).isoformat()
            chat_store.update_assistant_message(
                conn,
                asst_msg_id,
                content=full_text,
                status="stopped",
                model_used=model_id,
                attempts=[{"model_id": model_id, "outcome": "stopped", "code": "stopped", "at": now_iso}],
            )
            yield sse_event("stopped", {"message_id": asst_msg_id})

    except Exception as exc:
        classified = classify_provider_error(exc)
        if asst_msg_id:
            now_iso = datetime.now(timezone.utc).isoformat()
            chat_store.update_assistant_message(
                conn,
                asst_msg_id,
                content=full_text,
                status="error",
                model_used=model_id,
                error_category=classified.code,
                attempts=[{"model_id": model_id, "outcome": "error", "code": classified.code, "at": now_iso}],
            )
        yield sse_event("error", {
            "category": "provider",
            "code": classified.code,
            "message": classified.message,
            "retryable": classified.retryable,
            "message_id": asst_msg_id,
        })
    finally:
        conn.close()
        await release_stream_lock(conv_id)
