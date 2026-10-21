"""API routes for Chat-Brain backend (v1) — core, credentials, models, status."""

import sqlite3
import sys
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from app.config import get_settings
from app.db.database import check_db_health, get_db
from app.errors import AuthException, NotFoundException, ProviderException, ValidationException
from app.security import get_startup_token, verify_token
from app.services.ai.provider import ModelInfo, derive_kind, get_ai_provider
from app.services.default_model import (
    clear_default_chat_model,
    get_default_chat_model_status,
    set_default_chat_model,
)
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
from app.services.settings_store import (
    SETTING_LAST_PROVIDER_ERROR_AT,
    SETTING_LAST_PROVIDER_ERROR_CATEGORY,
    SETTING_LAST_PROVIDER_SUCCESS_AT,
    get_setting,
    record_provider_error,
    record_provider_success,
)

router = APIRouter(prefix="/api/v1")


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    db: bool


class BootstrapResponse(BaseModel):
    token: str


class SettingPayload(BaseModel):
    value: str = Field(..., description="String value to store for the given key")


class SettingItemResponse(BaseModel):
    key: str
    value: str


class GeminiCredentialResponse(BaseModel):
    configured: bool
    hint: str | None = None


class GeminiCredentialPutPayload(BaseModel):
    api_key: str = Field(..., min_length=1, description="Gemini API Key")


class GeminiTestResponse(BaseModel):
    ok: bool
    message: str


class DefaultChatModelStatus(BaseModel):
    model_id: str | None = None
    valid: bool
    reason: str | None = None


class ModelWithKind(ModelInfo):
    """ModelInfo enriched with computed kind fields."""
    kind: str
    kind_inferred: bool


class ModelsListResponse(BaseModel):
    models: list[ModelWithKind]
    connected: bool
    default_chat_model: DefaultChatModelStatus | None = None


class DefaultModelPayload(BaseModel):
    model_id: str = Field(..., min_length=1)
    force: bool = False


class ProviderErrorInfo(BaseModel):
    category: str
    at: str


class StatusResponse(BaseModel):
    api: str
    db: bool
    python_version: str
    key_configured: bool
    models_count: int
    models_last_checked: str | None
    default_chat_model: DefaultChatModelStatus | None
    last_provider_success_at: str | None
    last_provider_error: ProviderErrorInfo | None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _enrich_models(models: list[ModelInfo]) -> list[ModelWithKind]:
    """Attach computed kind + kind_inferred to each model (read-time, no storage)."""
    result: list[ModelWithKind] = []
    for m in models:
        kind_obj = derive_kind(m.id, m.supported_actions, list(m.capabilities))
        result.append(
            ModelWithKind(
                **m.model_dump(),
                kind=kind_obj.kind,
                kind_inferred=kind_obj.kind_inferred,
            )
        )
    return result


# ---------------------------------------------------------------------------
# Core system endpoints
# ---------------------------------------------------------------------------

@router.get("/health", response_model=HealthResponse)
def get_health() -> dict[str, Any]:
    """Return health status, current version, and database connectivity."""
    settings = get_settings()
    return {"status": "ok", "version": settings.version, "db": check_db_health()}


@router.get("/bootstrap", response_model=BootstrapResponse)
def get_bootstrap() -> dict[str, str]:
    """Return the per-startup security token for client state initialization."""
    return {"token": get_startup_token()}


@router.get("/settings")
def get_all_settings(
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, dict[str, str]]:
    """Return all stored settings key-value pairs (requires token)."""
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM settings ORDER BY key ASC;")
    rows = cursor.fetchall()
    return {"settings": {row["key"]: row["value"] for row in rows}}


@router.put("/settings/{key}", response_model=SettingItemResponse)
def put_setting_endpoint(
    key: str,
    payload: SettingPayload,
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, str]:
    """Store or update a setting by key (requires token)."""
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
        (key, payload.value),
    )
    conn.commit()
    return {"key": key, "value": payload.value}


# ---------------------------------------------------------------------------
# Gemini credentials endpoints
# ---------------------------------------------------------------------------

@router.get("/credentials/gemini", response_model=GeminiCredentialResponse)
def get_gemini_credentials(_token: str = Depends(verify_token)) -> dict[str, Any]:
    """Check if Gemini key is configured and return safe 4-char hint."""
    hint = get_gemini_key_hint()
    return {"configured": hint is not None, "hint": hint}


@router.put("/credentials/gemini", response_model=GeminiCredentialResponse)
def put_gemini_credentials(
    payload: GeminiCredentialPutPayload,
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, Any]:
    """Validate API key via provider first, then save to secure disk storage."""
    clean_key = payload.api_key.strip()
    if not clean_key:
        raise ValidationException("API key cannot be empty")

    provider = get_ai_provider()
    try:
        provider.validate_key(clean_key)
        record_provider_success(conn)
    except ProviderException:
        record_provider_error(conn, "provider")
        raise
    except Exception as exc:
        record_provider_error(conn, "internal")
        raise ProviderException("Unexpected error validating key", status_code=502) from exc

    save_gemini_key(clean_key)
    hint = clean_key[-4:] if len(clean_key) >= 4 else clean_key
    return {"configured": True, "hint": hint}


@router.delete("/credentials/gemini", response_model=GeminiCredentialResponse)
def delete_gemini_credentials(
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, Any]:
    """Remove the Gemini API key file and clear cached models from DB."""
    delete_gemini_key()
    clear_cached_models(conn)
    return {"configured": False, "hint": None}


@router.post("/credentials/gemini/test", response_model=GeminiTestResponse)
def test_gemini_credentials(
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, Any]:
    """Test saved Gemini key with upstream provider without revealing secret."""
    key = load_gemini_key()
    if not key:
        raise AuthException("No Gemini API key configured", status_code=401)

    provider = get_ai_provider()
    try:
        provider.validate_key(key)
        record_provider_success(conn)
    except ProviderException:
        record_provider_error(conn, "provider")
        raise
    except Exception as exc:
        record_provider_error(conn, "internal")
        raise ProviderException("Unexpected error testing key", status_code=502) from exc

    return {"ok": True, "message": "Gemini API key is valid and connected"}


# ---------------------------------------------------------------------------
# Models endpoints
# ---------------------------------------------------------------------------

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
    key_configured = bool(load_gemini_key())
    dcm = get_default_chat_model_status(conn, key_configured)
    return {
        "models": _enrich_models(discovered),
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
        "models": _enrich_models(cached),
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


# ---------------------------------------------------------------------------
# Status endpoint
# ---------------------------------------------------------------------------

@router.get("/status", response_model=StatusResponse)
def get_status(
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, Any]:
    """Return full system status. Never includes key or secrets."""
    key_configured = bool(load_gemini_key())
    cached = get_cached_models(conn)
    last_checked = cached[0].last_checked if cached else None

    dcm = get_default_chat_model_status(conn, key_configured)

    last_success = get_setting(conn, SETTING_LAST_PROVIDER_SUCCESS_AT)
    err_cat = get_setting(conn, SETTING_LAST_PROVIDER_ERROR_CATEGORY)
    err_at = get_setting(conn, SETTING_LAST_PROVIDER_ERROR_AT)

    last_error: dict[str, str] | None = None
    if err_cat and err_at:
        last_error = {"category": err_cat, "at": err_at}

    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"

    return {
        "api": "ok",
        "db": check_db_health(),
        "python_version": py_ver,
        "key_configured": key_configured,
        "models_count": len(cached),
        "models_last_checked": last_checked,
        "default_chat_model": dcm,
        "last_provider_success_at": last_success,
        "last_provider_error": last_error,
    }
