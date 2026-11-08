"""API routes for Chat-Brain backend (v1) — core, credentials, status."""

import sqlite3
import sys
from typing import Any
from fastapi import APIRouter, Depends
from app.config import get_settings
from app.db.database import check_db_health, get_db
from app.errors import AuthException, ProviderException, ValidationException
from app.schemas.core import (
    BootstrapResponse,
    GeminiCredentialPutPayload,
    GeminiCredentialResponse,
    GeminiTestResponse,
    HealthResponse,
    SettingItemResponse,
    SettingPayload,
    SettingsResponse,
    StatusResponse,
)
from app.security import get_startup_token, verify_token
from app.services.ai.model_health import get_health_store
from app.services.ai.model_pool import compute_pool_summary
from app.services.ai.provider import get_ai_provider
from app.services.chat.failover_events import get_failover_count_24h
from app.services.default_model import get_default_chat_model_status
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
    get_auto_pool_excluded,
    get_setting,
    put_setting,
    record_provider_error,
    record_provider_success,
)

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


@router.get("/settings", response_model=SettingsResponse)
def get_all_settings(
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, Any]:
    """Return all stored key/value pairs as a dictionary."""
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM settings ORDER BY key ASC;")
    return {"settings": {row["key"]: row["value"] for row in cursor.fetchall()}}


@router.put("/settings/{key}", response_model=SettingItemResponse)
def upsert_setting(
    key: str,
    payload: SettingPayload,
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, str]:
    """Store or update a setting string."""
    clean_key = key.strip()
    if not clean_key:
        raise ValidationException("Setting key cannot be empty")
    put_setting(conn, clean_key, payload.value)
    return {"key": clean_key, "value": payload.value}


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
        record_provider_success(conn)
    except ProviderException:
        record_provider_error(conn, "provider")
        raise
    except Exception as exc:
        record_provider_error(conn, "internal")
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
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, Any]:
    """Test connectivity using the stored key."""
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


@router.get("/status", response_model=StatusResponse)
def get_system_status(
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, Any]:
    """Aggregated system, connection, credential, and provider status."""
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
    health_store = get_health_store()
    excluded = get_auto_pool_excluded(conn)
    pool_summary = compute_pool_summary(cached, health_store.all(), excluded=excluded)
    failover_count = get_failover_count_24h(conn)

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
        "pool_summary": pool_summary,
        "failover_count_24h": failover_count,
    }
