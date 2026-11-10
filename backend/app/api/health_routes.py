"""API endpoint for model health and auto-failover status (M1.3c, C1)."""

from datetime import datetime, timezone
import sqlite3
from typing import Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.db.database import get_db
from app.security import verify_token
from app.services.ai.model_health import get_health_store
from app.services.ai.model_pool import rank_candidates
from app.services.ai.provider import ModelInfo, derive_kind
from app.services.model_registry import get_cached_models

router = APIRouter(prefix="/api/v1/models", dependencies=[Depends(verify_token)])


class ModelHealthItem(BaseModel):
    """Health metrics for a single chat model."""

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


class ModelsHealthResponse(BaseModel):
    """Response containing health status of chat models and ranked try order."""

    models: list[ModelHealthItem]
    ranked: list[str]


@router.get("/health", response_model=ModelsHealthResponse)
def get_models_health(
    conn: sqlite3.Connection = Depends(get_db),
) -> dict[str, Any]:
    """Retrieve health statistics and current failover ranking for chat models."""
    cached = get_cached_models(conn)
    health_store = get_health_store()

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
            })

    ranked = rank_candidates(
        chat_models,
        health_store.all(),
        now=now_dt,
    )

    return {
        "models": items,
        "ranked": [m.id for m in ranked],
    }
