"""API routes for Chat-Brain backend (v1) — core and credentials."""

import sqlite3
from typing import Any
from fastapi import APIRouter, Depends
from app.db.database import check_db_health, get_db
from app.errors import AuthException, ProviderException, ValidationException
from app.schemas.core import (
    BootstrapResponse,
    GeminiCredentialPutPayload,
    GeminiCredentialResponse,
    GeminiTestResponse,
    HealthResponse,
)
from app.security import get_startup_token, verify_token
from app.services.ai.model_health import get_health_store
from app.services.ai.provider import get_ai_provider
from app.services.key_store import (
    delete_gemini_key,
    get_gemini_key_hint,
    load_gemini_key,
    save_gemini_key,
)
from app.services.model_registry import (
    clear_cached_models,
    get_cached_models,
    save_cached_models,
)
from app.config import get_settings

router = APIRouter(prefix="/api/v1")


@router.get("/health", response_model=HealthResponse)
def health_check() -> dict[str, Any]:
    """Liveness probe reporting backend and SQLite status."""
    settings = get_settings()
    db_healthy = check_db_health()
    return {
        "status": "ok" if db_healthy else "degraded",
        "version": settings.version,
        "db": db_healthy,
    }


@router.get("/bootstrap", response_model=BootstrapResponse)
def bootstrap() -> dict[str, str]:
    """Retrieve the per-startup authentication token."""
    return {"token": get_startup_token()}


@router.get("/credentials/gemini", response_model=GeminiCredentialResponse)
def get_gemini_credentials(
    _token: str = Depends(verify_token),
) -> dict[str, Any]:
    """Return write-only status and masked hint of the stored Gemini key."""
    hint = get_gemini_key_hint()
    return {"configured": hint is not None, "hint": hint}


@router.put("/credentials/gemini", response_model=GeminiCredentialResponse)
def put_gemini_credentials(
    payload: GeminiCredentialPutPayload,
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, Any]:
    """Validate and write Gemini key to file; discover models on success."""
    clean_key = payload.api_key.strip()
    if not clean_key:
        raise ValidationException("API key cannot be empty")

    provider = get_ai_provider()
    try:
        provider.validate_key(clean_key)
    except ProviderException:
        raise
    except Exception as exc:
        raise ProviderException("Failed to validate Gemini key", status_code=502) from exc

    save_gemini_key(clean_key)

    try:
        discovered = provider.list_models(clean_key)
        save_cached_models(conn, discovered)
        get_health_store().clear_not_found_cooldowns(conn)
    except Exception:
        pass

    return {"configured": True, "hint": get_gemini_key_hint()}


@router.delete("/credentials/gemini", response_model=GeminiCredentialResponse)
def delete_gemini_credentials(
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, Any]:
    """Delete Gemini key and wipe model cache."""
    delete_gemini_key()
    clear_cached_models(conn)
    return {"configured": False, "hint": None}


@router.post("/credentials/gemini/test", response_model=GeminiTestResponse)
def test_gemini_credentials(
    _token: str = Depends(verify_token),
) -> dict[str, Any]:
    """Test connectivity using the stored key."""
    key = load_gemini_key()
    if not key:
        raise AuthException("No Gemini API key configured", status_code=401)

    provider = get_ai_provider()
    try:
        provider.validate_key(key)
    except ProviderException:
        raise
    except Exception as exc:
        raise ProviderException("Unexpected error testing key", status_code=502) from exc

    return {"ok": True, "message": "Gemini API key is valid and connected"}
