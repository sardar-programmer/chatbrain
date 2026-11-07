"""Winner chunk streaming and persistence loop (M1.3c)."""

import asyncio
from collections.abc import AsyncIterator
import logging
import sqlite3
import time
from typing import Any
from fastapi import Request
from app.errors import ProviderException
from app.services.ai.error_classifier import classify_provider_error
from app.services.ai.provider import StreamChunk
from app.services.chat import chat_store
from app.services.chat.chat_stream_session import sse_event
from app.services.chat.failover_config import get_failover_config

logger = logging.getLogger("chatbrain.chat.failover_stream")


async def is_client_disconnected(request: Request) -> bool:
    """Safe check for client disconnect without crashing on mock requests."""
    try:
        return await request.is_disconnected()
    except Exception:
        return False


def finalize_assistant_msg(
    conn: sqlite3.Connection,
    msg_id: str,
    text: str,
    status: str,
    model_id: str | None,
    error_code: str | None = None,
    attempts: list[dict[str, Any]] | None = None,
) -> None:
    """Helper to persist finalized assistant message status and attempt metadata."""
    saved_text = text
    saved_model = model_id
    if not saved_text or not saved_model:
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT content, model_used FROM messages WHERE id = ?;", (msg_id,))
            row = cursor.fetchone()
            if row:
                if not saved_text and row["content"]:
                    saved_text = row["content"]
                if not saved_model and row["model_used"]:
                    saved_model = row["model_used"]
        except Exception:
            pass

    chat_store.update_assistant_message(
        conn,
        msg_id,
        content=saved_text,
        status=status,
        model_used=saved_model,
        error_category=error_code,
        attempts=attempts or [],
    )


async def stream_winner_chunks(
    conn: sqlite3.Connection,
    asst_msg_id: str,
    winner_model_id: str,
    stream_iter: AsyncIterator[StreamChunk],
    first_chunk: StreamChunk,
    request: Request,
    attempts: list[dict[str, Any]],
) -> AsyncIterator[str]:
    """Stream remaining chunks from the winning model until completion or error."""
    config = get_failover_config()
    full_text = ""
    last_save_mono = time.monotonic()
    chunk_task: asyncio.Task[StreamChunk] | None = None

    try:
        yield sse_event("status", {"phase": "writing", "text": "Writing the answer"})

        if first_chunk.finish_reason == "SAFETY":
            raise ProviderException(
                "The response was blocked by safety filters.",
                code="safety_blocked",
                retryable=False,
            )

        if first_chunk.text:
            full_text += first_chunk.text
            conn.execute("UPDATE messages SET content = ? WHERE id = ?;", (full_text, asst_msg_id))
            conn.commit()
            last_save_mono = time.monotonic()
            yield sse_event("delta", {"text": first_chunk.text})

        while True:
            if await is_client_disconnected(request):
                raise asyncio.CancelledError("Client disconnected")

            start_wait = time.monotonic()
            chunk_task = asyncio.create_task(stream_iter.__anext__())
            chunk: StreamChunk | None = None

            while True:
                elapsed = time.monotonic() - start_wait
                remaining = config.idle_chunk_timeout - elapsed
                if remaining <= 0:
                    chunk_task.cancel()
                    raise TimeoutError("Model streaming timed out")

                step_timeout = min(remaining, config.ping_interval)
                done, _ = await asyncio.wait([chunk_task], timeout=step_timeout)
                if chunk_task in done:
                    chunk = chunk_task.result()
                    break

                if await is_client_disconnected(request):
                    chunk_task.cancel()
                    raise asyncio.CancelledError("Client disconnected")
                yield ": ping\n\n"

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
                if now_mono - last_save_mono >= config.persistence_interval:
                    conn.execute(
                        "UPDATE messages SET content = ? WHERE id = ?;",
                        (full_text, asst_msg_id),
                    )
                    conn.commit()
                    last_save_mono = now_mono

    except StopAsyncIteration:
        finalize_assistant_msg(conn, asst_msg_id, full_text, "done", winner_model_id, attempts=attempts)
        yield sse_event("done", {"message_id": asst_msg_id, "status": "done"})

    except (GeneratorExit, asyncio.CancelledError):
        finalize_assistant_msg(conn, asst_msg_id, full_text, "stopped", winner_model_id, "stopped", attempts=attempts)
        raise

    except Exception as exc:
        classified = classify_provider_error(exc)
        finalize_assistant_msg(
            conn,
            asst_msg_id,
            full_text,
            "error",
            winner_model_id,
            classified.code,
            attempts=attempts,
        )
        yield sse_event("error", {
            "category": "provider",
            "code": classified.code,
            "message": classified.message,
            "retryable": classified.retryable,
            "message_id": asst_msg_id,
        })
    finally:
        if chunk_task and not chunk_task.done():
            chunk_task.cancel()
        if hasattr(stream_iter, "aclose"):
            try:
                await asyncio.shield(stream_iter.aclose())
            except Exception:
                pass
