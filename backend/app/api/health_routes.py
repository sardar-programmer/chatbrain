"""API endpoints for model health, auto-failover pool status, and active scan (M1.3c)."""

import asyncio
from datetime import datetime, timezone
import logging
import sqlite3
import time
from typing import Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from app.db.database import get_db
from app.errors import AuthException
from app.security import verify_token
from app.services.ai.error_classifier import classify_provider_error
from app.services.ai.model_health import get_health_store
from app.services.ai.model_pool import rank_candidates
from app.services.ai.provider import ModelInfo, derive_kind, get_ai_provider
from app.services.default_model import get_default_chat_model_status
from app.services.key_store import load_gemini_key
from app.services.model_registry import get_cached_models
from app.services.settings_store import get_auto_pool_excluded

logger = logging.getLogger("chatbrain.api.health")

router = APIRouter(prefix="/api/v1/models", dependencies=[Depends(verify_token)])


class ModelHealthItem(BaseModel):
    """Health metrics and configuration status for a single model."""

    model_id: str
    kind: str
    successes: int
    failures: int
    ttft_ms_ewma: float | None = None
    consecutive_failures: int
    in_cooldown: bool
    cooldown_until: str | None = None
    last_error_code: str | None = None
    last_success_at: str | None = None
    excluded: bool


class ModelsHealthResponse(BaseModel):
    """Response containing health status of chat models and ranked try order."""

    models: list[ModelHealthItem]
    ranked: list[str]


class ModelScanPayload(BaseModel):
    """Payload for initiating a health scan across chat models."""

    limit: int = Field(default=12, ge=1, le=50)


class ModelScanResultItem(BaseModel):
    """Result for a single model check."""

    model_id: str
    ok: bool
    ttft_ms: float | None = None
    code: str | None = None


class ModelScanResponse(BaseModel):
    """Summary of active model health scan."""

    checked: int
    available: int
    failed: int
    results: list[ModelScanResultItem]


@router.get("/health", response_model=ModelsHealthResponse)
def get_models_health(
    conn: sqlite3.Connection = Depends(get_db),
) -> dict[str, Any]:
    """Retrieve health statistics and current failover ranking for chat models."""
    cached = get_cached_models(conn)
    health_store = get_health_store()
    excluded = get_auto_pool_excluded(conn)
    excluded_set = set(excluded)

    dcm = get_default_chat_model_status(conn, key_configured=bool(load_gemini_key()))
    default_model_id = dcm["model_id"] if dcm.get("valid") else None

    now_dt = datetime.now(timezone.utc)
    chat_models: list[ModelInfo] = []
    items: list[dict[str, Any]] = []

    for m in cached:
        kind_info = derive_kind(m.id, m.supported_actions, m.capabilities)
        if kind_info.kind == "chat":
            chat_models.append(m)
            rec = health_store.get(m.id)
            items.append({
                "model_id": m.id,
                "kind": "chat",
                "successes": rec.successes,
                "failures": rec.failures,
                "ttft_ms_ewma": rec.ttft_ms_ewma,
                "consecutive_failures": rec.consecutive_failures,
                "in_cooldown": rec.is_in_cooldown(now_dt),
                "cooldown_until": rec.cooldown_until,
                "last_error_code": rec.last_error_code,
                "last_success_at": rec.last_success_at,
                "excluded": m.id in excluded_set,
            })

    ranked = rank_candidates(
        chat_models,
        health_store.all(),
        default_model_id=default_model_id,
        excluded=excluded,
        now=now_dt,
    )

    return {
        "models": items,
        "ranked": [m.id for m in ranked],
    }


async def _scan_single_candidate(
    model_id: str,
    api_key: str,
    conn: sqlite3.Connection,
) -> dict[str, Any]:
    """Send probe request to a single candidate model."""
    provider = get_ai_provider()
    health_store = get_health_store()
    start_mono = time.monotonic()

    try:
        stream_iter = aiter(
            provider.stream_chat(
                api_key=api_key,
                model_id=model_id,
                messages=[{"role": "user", "content": "ping"}],
                system_instruction=None,
            )
        )
        chunk = await asyncio.wait_for(stream_iter.__anext__(), timeout=10.0)
        ttft_ms = round((time.monotonic() - start_mono) * 1000.0, 1)

        if hasattr(stream_iter, "aclose"):
            try:
                await asyncio.shield(stream_iter.aclose())
            except Exception:
                pass

        health_store.record_success(model_id, ttft_ms, conn=conn)
        logger.info("Health scan model %s: ok (ttft=%sms)", model_id, ttft_ms)
        return {"model_id": model_id, "ok": True, "ttft_ms": ttft_ms, "code": None}

    except Exception as exc:
        classified = classify_provider_error(exc)
        health_store.record_failure(model_id, classified.code, conn=conn)
        logger.info("Health scan model %s: error code=%s", model_id, classified.code)
        return {"model_id": model_id, "ok": False, "ttft_ms": None, "code": classified.code}


@router.post("/health/scan", response_model=ModelScanResponse)
async def scan_models_health(
    payload: ModelScanPayload | None = None,
    conn: sqlite3.Connection = Depends(get_db),
) -> dict[str, Any]:
    """Actively probe chat models to record health metrics with concurrency 3."""
    key = load_gemini_key()
    if not key:
        raise AuthException("No Gemini API key configured", status_code=401)

    limit = payload.limit if payload and payload.limit is not None else 12
    cached = get_cached_models(conn)
    chat_models = [
        m for m in cached
        if derive_kind(m.id, m.supported_actions, m.capabilities).kind == "chat"
    ]
    to_scan = chat_models[:limit]

    results: list[dict[str, Any]] = []
    quota_streak = 0

    for i in range(0, len(to_scan), 3):
        batch = to_scan[i : i + 3]
        batch_tasks = [_scan_single_candidate(m.id, key, conn) for m in batch]
        batch_results = await asyncio.gather(*batch_tasks)

        for res in batch_results:
            results.append(res)
            if res.get("code") == "quota":
                quota_streak += 1
            else:
                quota_streak = 0

        if quota_streak >= 3:
            logger.info("Health scan stopped early after 3 consecutive quota errors")
            break

    checked = len(results)
    available = sum(1 for r in results if r["ok"])
    failed = sum(1 for r in results if not r["ok"])

    return {
        "checked": checked,
        "available": available,
        "failed": failed,
        "results": results,
    }
