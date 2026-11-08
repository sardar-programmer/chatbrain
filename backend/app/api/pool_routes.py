"""API endpoints for auto-failover pool controls and failover history (M1.3d)."""

from datetime import datetime, timezone
import sqlite3
from typing import Any
from fastapi import APIRouter, Depends, Query
from app.db.database import get_db
from app.errors import NotFoundException, ValidationException
from app.schemas.core import (
    FailoverEventItem,
    HealthResetResponse,
    PoolPatchPayload,
    PoolResponse,
)
from app.security import verify_token
from app.services.ai.model_health import get_health_store
from app.services.ai.model_pool import compute_pool_summary
from app.services.ai.provider import derive_kind
from app.services.chat.failover_events import get_recent_failover_events
from app.services.model_registry import get_cached_models
from app.services.settings_store import (
    SETTING_DEFAULT_CHAT_MODEL,
    get_auto_pool_excluded,
    get_setting,
    set_auto_pool_excluded,
)

router = APIRouter(prefix="/api/v1/models", dependencies=[Depends(verify_token)])


@router.get("/pool", response_model=PoolResponse)
def get_model_pool(
    conn: sqlite3.Connection = Depends(get_db),
) -> dict[str, Any]:
    """Retrieve auto-failover pool excluded list and model status counts."""
    cached = get_cached_models(conn)
    health_store = get_health_store()
    excluded = get_auto_pool_excluded(conn)
    summary = compute_pool_summary(cached, health_store.all(), excluded=excluded)

    return {
        "excluded": excluded,
        **summary,
    }


@router.patch("/pool/{model_id}", response_model=PoolResponse)
def patch_model_pool_member(
    model_id: str,
    payload: PoolPatchPayload,
    conn: sqlite3.Connection = Depends(get_db),
) -> dict[str, Any]:
    """Exclude or include a specific chat model from the auto-failover pool."""
    cached = get_cached_models(conn)
    match = next((m for m in cached if m.id == model_id), None)
    if match is None:
        raise NotFoundException(f"Model '{model_id}' not found in cached model list")

    kind_info = derive_kind(match.id, match.supported_actions, match.capabilities)
    if kind_info.kind != "chat":
        raise ValidationException(f"Model '{model_id}' is not a chat model", status_code=422)

    chat_models = [
        m for m in cached
        if derive_kind(m.id, m.supported_actions, m.capabilities).kind == "chat"
    ]
    chat_model_ids = {m.id for m in chat_models}
    excluded = get_auto_pool_excluded(conn)

    if payload.excluded:
        saved_preferred = get_setting(conn, SETTING_DEFAULT_CHAT_MODEL)
        if saved_preferred == model_id:
            raise ValidationException("Clear the preferred model first", status_code=422)

        new_excluded_set = set(excluded) | {model_id}
        if len(new_excluded_set.intersection(chat_model_ids)) >= len(chat_model_ids):
            raise ValidationException("Cannot exclude the last remaining chat model from the auto pool", status_code=422)

        if model_id not in excluded:
            excluded.append(model_id)
            set_auto_pool_excluded(conn, excluded)
    else:
        if model_id in excluded:
            excluded = [x for x in excluded if x != model_id]
            set_auto_pool_excluded(conn, excluded)

    health_store = get_health_store()
    summary = compute_pool_summary(cached, health_store.all(), excluded=excluded)
    return {
        "excluded": excluded,
        **summary,
    }


@router.post("/health/reset", response_model=HealthResetResponse)
def reset_model_health(
    conn: sqlite3.Connection = Depends(get_db),
) -> dict[str, bool]:
    """Clear all model health stats, EWMA TTFT, and cooldowns."""
    get_health_store().reset(conn=conn)
    return {"reset": True}


@router.get("/failovers", response_model=list[FailoverEventItem])
def get_failovers(
    limit: int = Query(default=20, ge=1, le=100),
    conn: sqlite3.Connection = Depends(get_db),
) -> list[dict[str, Any]]:
    """Retrieve recent failover events (newest first)."""
    return get_recent_failover_events(conn, limit=limit)
