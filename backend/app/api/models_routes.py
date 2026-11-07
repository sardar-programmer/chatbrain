"""API endpoints for model discovery and default chat model configuration."""

import sqlite3
from typing import Any
from fastapi import APIRouter, Depends
from app.db.database import get_db
from app.errors import AuthException, ProviderException
from app.schemas.core import (
    DefaultChatModelStatus,
    DefaultModelPayload,
    ModelWithKind,
    ModelsListResponse,
)
from app.security import verify_token
from app.services.ai.model_health import get_health_store
from app.services.ai.provider import ModelInfo, derive_kind, get_ai_provider
from app.services.default_model import (
    clear_default_chat_model,
    get_default_chat_model_status,
    set_default_chat_model,
)
from app.services.key_store import load_gemini_key
from app.services.model_registry import (
    get_cached_models,
    save_cached_models,
)
from app.services.settings_store import (
    record_provider_error,
    record_provider_success,
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

    provider = get_ai_provider()
    try:
        discovered = provider.list_models(key)
        record_provider_success(conn)
    except ProviderException:
        record_provider_error(conn, "provider")
        raise
    except Exception as exc:
        record_provider_error(conn, "internal")
        raise ProviderException("Unexpected error fetching models", status_code=502) from exc

    save_cached_models(conn, discovered)
    get_health_store().clear_not_found_cooldowns(conn)

    key_configured = bool(load_gemini_key())
    dcm = get_default_chat_model_status(conn, key_configured)
    return {
        "models": enrich_models(discovered),
        "connected": True,
        "default_chat_model": dcm,
    }


@router.get("/models", response_model=ModelsListResponse)
def get_models(
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, Any]:
    """Return cached models with kind. Empty + connected:false when no key."""
    key = load_gemini_key()
    if not key:
        return {"models": [], "connected": False, "default_chat_model": None}

    cached = get_cached_models(conn)
    dcm = get_default_chat_model_status(conn, True)
    return {
        "models": enrich_models(cached),
        "connected": True,
        "default_chat_model": dcm,
    }


@router.get("/models/default", response_model=DefaultChatModelStatus)
def get_default_model(
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, Any]:
    """Return the saved default chat model and its validity."""
    key_configured = bool(load_gemini_key())
    return get_default_chat_model_status(conn, key_configured)


@router.put("/models/default", response_model=DefaultChatModelStatus)
def put_default_model(
    payload: DefaultModelPayload,
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, Any]:
    """Set the default chat model. Must be in the cached list; must be kind=chat unless force=true."""
    return set_default_chat_model(conn, payload.model_id, payload.force)


@router.delete("/models/default", response_model=DefaultChatModelStatus)
def delete_default_model(
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, Any]:
    """Clear the default chat model selection."""
    return clear_default_chat_model(conn)
