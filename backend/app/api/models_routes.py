"""API endpoints for model discovery debug endpoints (v1)."""

import sqlite3
from typing import Any
from fastapi import APIRouter, Depends
from app.db.database import get_db
from app.errors import AuthException, ProviderException
from app.schemas.core import (
    ModelWithKind,
    ModelsListResponse,
)
from app.security import verify_token
from app.services.ai.provider import ModelInfo, derive_kind
from app.services.key_store import load_gemini_key
from app.services.model_registry import (
    discover_and_cache_models,
    get_cached_models,
)

router = APIRouter(prefix="/api/v1")


def enrich_models(models: list[ModelInfo]) -> list[ModelWithKind]:
    """Attach computed kind + kind_inferred to each model (read-time, no storage)."""
    result: list[ModelWithKind] = []
    for m in models:
        caps = [c for c in m.capabilities if c] if m.capabilities else ["unknown"]
        if not caps:
            caps = ["unknown"]
        kind_obj = derive_kind(m.id, m.supported_actions, caps)
        data = m.model_dump()
        data["capabilities"] = caps
        result.append(
            ModelWithKind(
                **data,
                kind=kind_obj.kind,
                kind_inferred=kind_obj.kind_inferred,
            )
        )
    return result


@router.post("/models/refresh", response_model=ModelsListResponse)
def refresh_models(
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, Any]:
    """Discover models with the saved key and replace the cache in model_registry."""
    key = load_gemini_key()
    if not key:
        raise AuthException("No Gemini API key configured", status_code=401)

    try:
        discovered = discover_and_cache_models(conn, key)
    except ProviderException:
        raise
    except Exception as exc:
        raise ProviderException("Unexpected error fetching models", status_code=502) from exc

    return {
        "models": enrich_models(discovered),
        "connected": True,
    }


@router.get("/models", response_model=ModelsListResponse)
def get_models(
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, Any]:
    """Return cached models with kind. Empty + connected:false when no key."""
    key = load_gemini_key()
    if not key:
        return {"models": [], "connected": False}

    cached = get_cached_models(conn)
    return {
        "models": enrich_models(cached),
        "connected": True,
    }
