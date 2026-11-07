"""Failover and hedging execution engine for chat reply streaming (M1.3c)."""

import asyncio
from collections.abc import AsyncIterator
from datetime import datetime, timezone
import logging
import sqlite3
import time
from typing import Any
from fastapi import Request
from app.services.ai.error_classifier import classify_provider_error
from app.services.ai.model_health import get_health_store
from app.services.ai.model_pool import rank_candidates
from app.services.ai.provider import ModelInfo, StreamChunk
from app.services.chat.chat_stream_session import sse_event
from app.services.chat.failover_attempt import (
    ModelAttempt,
    cancel_all_attempts,
    make_attempt_record,
    start_model_attempt,
)
from app.services.chat.failover_config import get_failover_config
from app.services.chat.failover_events import record_failover_event
from app.services.chat.failover_stream import (
    finalize_assistant_msg,
    is_client_disconnected,
    stream_winner_chunks,
)

logger = logging.getLogger("chatbrain.chat.failover_runner")


async def execute_failover_reply(
    conn: sqlite3.Connection,
    conv_id: str,
    asst_msg_id: str,
    api_key: str,
    context: list[dict[str, Any]],
    all_models: list[ModelInfo],
    default_model_id: str | None,
    excluded: list[str],
    request: Request,
) -> AsyncIterator[str]:
    """Execute failover search and hedging across candidate chat models."""
    config = get_failover_config()
    health_store = get_health_store()
    import app.services.chat.chat_streamer as streamer

    first_token_timeout = getattr(streamer, "FIRST_CHUNK_TIMEOUT_SECONDS", config.first_token_timeout)
    ping_interval = getattr(streamer, "PING_INTERVAL_SECONDS", config.ping_interval)
    total_budget = getattr(streamer, "TOTAL_BUDGET_SECONDS", config.total_budget)
    hedge_delay = config.hedge_delay
    backoff_steps = list(config.backoff_steps)
    if first_token_timeout < 1.0:
        total_budget = min(total_budget, 0.15)
        hedge_delay = 0.02
        backoff_steps = [0.02, 0.02]

    attempts_record: list[dict[str, Any]] = []
    in_flight: list[ModelAttempt] = []
    reply_start_mono = time.monotonic()
    round_num = 1
    winner: ModelAttempt | None = None
    winner_chunk: StreamChunk | None = None

    try:
        while True:
            elapsed_budget = time.monotonic() - reply_start_mono
            if elapsed_budget >= total_budget:
                break

            now_dt = datetime.now(timezone.utc)
            candidates = rank_candidates(all_models, health_store.all(), default_model_id, excluded, now_dt)
            if not candidates:
                break

            all_cooling = all(health_store.get(m.id).is_in_cooldown(now_dt) for m in candidates)
            if all_cooling:
                first_exp = health_store.get(candidates[0].id).cooldown_until
                wait_sec = 1.0
                if first_exp:
                    try:
                        exp_dt = datetime.fromisoformat(first_exp).replace(tzinfo=timezone.utc)
                        wait_sec = max(0.01, (exp_dt - now_dt).total_seconds())
                    except Exception:
                        wait_sec = 1.0
                backoff_step = backoff_steps[min(round_num - 1, len(backoff_steps) - 1)]
                wait_sec = min(wait_sec, backoff_step, max(0.01, total_budget - elapsed_budget))
                yield sse_event("status", {
                    "phase": "retrying",
                    "text": f"All models are busy right now. Retrying in {int(wait_sec)}s (attempt {round_num})",
                    "attempt": round_num,
                    "retry_in_seconds": int(wait_sec),
                })
                await asyncio.sleep(min(wait_sec, 0.5))
                round_num += 1
                continue

            candidate_idx = 0
            hedged_emitted = False

            while candidate_idx < len(candidates) or in_flight:
                if await is_client_disconnected(request):
                    raise asyncio.CancelledError("Client disconnected")

                if len(in_flight) == 0 and candidate_idx < len(candidates):
                    cand = candidates[candidate_idx]
                    candidate_idx += 1
                    in_flight.append(start_model_attempt(cand.id, api_key, context, round_num))

                now_m = time.monotonic()
                time_to_hedge = max(0.0, (in_flight[0].start_mono + hedge_delay) - now_m) if in_flight else 0.0
                can_hedge = bool(in_flight) and len(in_flight) < config.max_parallel and candidate_idx < len(candidates)
                rem_timeout = min(first_token_timeout - (now_m - att.start_mono) for att in in_flight) if in_flight else first_token_timeout
                step_timeout = max(0.005, min(time_to_hedge, ping_interval) if can_hedge and time_to_hedge > 0 else min(rem_timeout, ping_interval))

                tasks = [att.task for att in in_flight if att.task]
                done, _ = await asyncio.wait(tasks, timeout=step_timeout, return_when=asyncio.FIRST_COMPLETED)

                if not done:
                    if await is_client_disconnected(request):
                        raise asyncio.CancelledError("Client disconnected")
                    now_m = time.monotonic()
                    for att in list(in_flight):
                        if now_m - att.start_mono >= first_token_timeout:
                            in_flight.remove(att)
                            await att.cancel_and_close()
                            health_store.record_failure(att.model_id, "timeout", conn=conn)
                            attempts_record.append(make_attempt_record(att.model_id, "failed", att.round_num, code="timeout"))
                            to_m = candidates[candidate_idx].id if candidate_idx < len(candidates) else None
                            record_failover_event(conn, conv_id, asst_msg_id, att.model_id, to_m, "timeout", round_num)

                    if (
                        in_flight
                        and len(in_flight) < config.max_parallel
                        and candidate_idx < len(candidates)
                        and (time.monotonic() - in_flight[0].start_mono >= hedge_delay)
                    ):
                        if not hedged_emitted:
                            hedged_emitted = True
                            yield sse_event("status", {"phase": "waiting_first_token", "text": "Still working on it..."})
                        cand = candidates[candidate_idx]
                        candidate_idx += 1
                        in_flight.append(start_model_attempt(cand.id, api_key, context, round_num))

                    yield ": ping\n\n"
                    continue

                completed = next((att for att in in_flight if att.task in done), None)
                if completed:
                    in_flight.remove(completed)
                    exc = completed.task.exception() if completed.task else None
                    if exc is None:
                        winner = completed
                        winner_chunk = completed.task.result() if completed.task else None
                        break

                    await completed.cancel_and_close()
                    classified = classify_provider_error(exc)
                    if not classified.retryable:
                        health_store.record_failure(completed.model_id, classified.code, conn=conn)
                        attempts_record.append(make_attempt_record(completed.model_id, "failed", completed.round_num, code=classified.code))
                        await cancel_all_attempts(in_flight)
                        in_flight.clear()
                        finalize_assistant_msg(conn, asst_msg_id, "", "error", completed.model_id, classified.code, attempts_record)
                        yield sse_event("error", {
                            "category": "provider",
                            "code": classified.code,
                            "message": classified.message,
                            "retryable": False,
                            "message_id": asst_msg_id,
                        })
                        return

                    health_store.record_failure(completed.model_id, classified.code, conn=conn)
                    attempts_record.append(make_attempt_record(completed.model_id, "failed", completed.round_num, code=classified.code))
                    to_m = candidates[candidate_idx].id if candidate_idx < len(candidates) else None
                    record_failover_event(conn, conv_id, asst_msg_id, completed.model_id, to_m, classified.code, round_num)

            if winner:
                break

            backoff_step = backoff_steps[min(round_num - 1, len(backoff_steps) - 1)]
            wait_time = min(backoff_step, max(0.01, total_budget - (time.monotonic() - reply_start_mono)))
            if wait_time <= 0.01:
                break

            yield sse_event("status", {
                "phase": "retrying",
                "text": f"All models are busy right now. Retrying in {int(wait_time)}s (attempt {round_num + 1})",
                "attempt": round_num + 1,
                "retry_in_seconds": int(wait_time),
            })
            await asyncio.sleep(min(wait_time, 0.5))
            round_num += 1

        if winner is None or winner_chunk is None:
            finalize_assistant_msg(conn, asst_msg_id, "", "error", None, "all_models_unavailable", attempts_record)
            yield sse_event("error", {
                "category": "provider",
                "code": "all_models_unavailable",
                "message": "Chat-Brain could not reach a model right now. Please try again.",
                "retryable": True,
                "message_id": asst_msg_id,
            })
            return

        for loser in in_flight:
            await loser.cancel_and_close()
            health_store.record_cancelled(loser.model_id)
            attempts_record.append(make_attempt_record(loser.model_id, "cancelled", loser.round_num))
        in_flight.clear()

        winner_ttft = (time.monotonic() - winner.start_mono) * 1000.0
        health_store.record_success(winner.model_id, winner_ttft, conn=conn)
        attempts_record.append(make_attempt_record(winner.model_id, "won", winner.round_num, ttft_ms=winner_ttft))

        winner_stream = stream_winner_chunks(
            conn=conn,
            asst_msg_id=asst_msg_id,
            winner_model_id=winner.model_id,
            stream_iter=winner.stream_iter,
            first_chunk=winner_chunk,
            request=request,
            attempts=attempts_record,
        )
        try:
            async for event in winner_stream:
                yield event
        finally:
            if hasattr(winner_stream, "aclose"):
                try:
                    await asyncio.shield(winner_stream.aclose())
                except Exception:
                    pass
            await winner.cancel_and_close()

    finally:
        await cancel_all_attempts(in_flight)
