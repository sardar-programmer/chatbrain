"""Attempt management and resource cleanup for model streaming (M1.3c)."""

import asyncio
from collections.abc import AsyncIterator
from datetime import datetime, timezone
import logging
import time
from typing import Any
from app.services.ai.provider import StreamChunk

logger = logging.getLogger("chatbrain.chat.failover_attempt")


class ModelAttempt:
    """Represents a single in-flight attempt to query an AI model."""

    def __init__(
        self,
        model_id: str,
        stream_iter: AsyncIterator[StreamChunk],
        start_mono: float,
        round_num: int,
    ) -> None:
        self.model_id = model_id
        self.stream_iter = stream_iter
        self.start_mono = start_mono
        self.round_num = round_num
        self.task: asyncio.Task[StreamChunk] | None = None
        self.first_chunk: StreamChunk | None = None

    def start_first_token_task(self) -> asyncio.Task[StreamChunk]:
        """Start async task to fetch first chunk from stream."""
        self.task = asyncio.create_task(self.stream_iter.__anext__())
        return self.task

    async def cancel_and_close(self) -> None:
        """Cancel task and safely close upstream provider generator."""
        if self.task and not self.task.done():
            self.task.cancel()
        if hasattr(self.stream_iter, "aclose"):
            try:
                await asyncio.shield(self.stream_iter.aclose())
            except Exception as exc:
                logger.debug("Error closing stream iterator for %s: %s", self.model_id, exc)


async def cancel_all_attempts(attempts: list[ModelAttempt]) -> None:
    """Cancel all active in-flight attempts and close their streams."""
    for att in attempts:
        await att.cancel_and_close()


def start_model_attempt(
    model_id: str,
    api_key: str,
    context: list[dict[str, Any]],
    round_num: int,
) -> ModelAttempt:
    """Initialize and start first-chunk task for a model candidate."""
    from app.services.ai.provider import get_ai_provider
    from app.services.chat.prompts import SYSTEM_PROMPT

    provider = get_ai_provider()
    stream_iter = aiter(
        provider.stream_chat(
            api_key=api_key,
            model_id=model_id,
            messages=context,
            system_instruction=SYSTEM_PROMPT,
        )
    )
    att = ModelAttempt(model_id, stream_iter, time.monotonic(), round_num)
    att.start_first_token_task()
    return att


def make_attempt_record(
    model_id: str,
    outcome: str,
    round_num: int,
    code: str | None = None,
    ttft_ms: float | None = None,
) -> dict[str, Any]:
    """Format structured attempt metadata."""
    return {
        "model_id": model_id,
        "outcome": outcome,
        "code": code,
        "ttft_ms": round(ttft_ms, 1) if ttft_ms is not None else None,
        "round": round_num,
        "at": datetime.now(timezone.utc).isoformat(),
    }
