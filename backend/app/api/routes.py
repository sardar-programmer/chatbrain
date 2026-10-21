"""API routes for Chat-Brain backend (v1)."""

import sqlite3
from typing import Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from app.config import get_settings
from app.db.database import check_db_health, get_db
from app.errors import AuthException, ProviderException, ValidationException
from app.security import get_startup_token, verify_token
from app.services.ai.provider import ModelInfo, get_ai_provider
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

router = APIRouter(prefix="/api/v1")


class HealthResponse(BaseModel):
    """Health check payload."""

    status: str = "ok"
    version: str
    db: bool


class BootstrapResponse(BaseModel):
    """Startup authentication bootstrap payload."""

    token: str


class SettingPayload(BaseModel):
    """Key-value setting payload."""

    value: str = Field(..., description="String value to store for the given key")


class SettingItemResponse(BaseModel):
    """Single setting response."""

    key: str
    value: str


class GeminiCredentialResponse(BaseModel):
    """Gemini credential configuration status and masked hint."""

    configured: bool
    hint: str | None = None


class GeminiCredentialPutPayload(BaseModel):
    """Payload to configure the Gemini API key."""

    api_key: str = Field(..., min_length=1, description="Gemini API Key")


class GeminiTestResponse(BaseModel):
    """Result of testing saved Gemini credentials."""

    ok: bool
    message: str


class ModelsListResponse(BaseModel):
    """Discovered or cached AI models response."""

    models: list[ModelInfo]
    connected: bool


# Core System Endpoints
@router.get("/health", response_model=HealthResponse)
def get_health() -> dict[str, Any]:
    """Return health status, current version, and database connectivity."""
    settings = get_settings()
    db_ok = check_db_health()
    return {
        "status": "ok",
        "version": settings.version,
        "db": db_ok,
    }


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
    settings_dict = {row["key"]: row["value"] for row in rows}
    return {"settings": settings_dict}


@router.put("/settings/{key}", response_model=SettingItemResponse)
def put_setting(
    key: str,
    payload: SettingPayload,
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, str]:
    """Store or update a setting by key (requires token)."""
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value;
        """,
        (key, payload.value),
    )
    conn.commit()
    return {"key": key, "value": payload.value}


# Gemini Credentials Endpoints
@router.get("/credentials/gemini", response_model=GeminiCredentialResponse)
def get_gemini_credentials(_token: str = Depends(verify_token)) -> dict[str, Any]:
    """Check if Gemini key is configured and return safe 4-char hint."""
    hint = get_gemini_key_hint()
    return {
        "configured": hint is not None,
        "hint": hint,
    }


@router.put("/credentials/gemini", response_model=GeminiCredentialResponse)
def put_gemini_credentials(
    payload: GeminiCredentialPutPayload,
    _token: str = Depends(verify_token),
) -> dict[str, Any]:
    """Validate API key via provider first, then save to secure disk storage."""
    clean_key = payload.api_key.strip()
    if not clean_key:
        raise ValidationException("API key cannot be empty")

    provider = get_ai_provider()
    is_valid = provider.validate_key(clean_key)
    if not is_valid:
        raise ProviderException("Invalid Gemini API key", status_code=400)

    save_gemini_key(clean_key)
    hint = clean_key[-4:] if len(clean_key) >= 4 else clean_key
    return {
        "configured": True,
        "hint": hint,
    }


@router.delete("/credentials/gemini", response_model=GeminiCredentialResponse)
def delete_gemini_credentials(
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, Any]:
    """Remove the Gemini API key file and clear cached models from DB."""
    delete_gemini_key()
    clear_cached_models(conn)
    return {
        "configured": False,
        "hint": None,
    }


@router.post("/credentials/gemini/test", response_model=GeminiTestResponse)
def test_gemini_credentials(_token: str = Depends(verify_token)) -> dict[str, Any]:
    """Test saved Gemini key with upstream provider without revealing secret."""
    key = load_gemini_key()
    if not key:
        raise AuthException("No Gemini API key configured", status_code=401)

    provider = get_ai_provider()
    is_valid = provider.validate_key(key)
    if not is_valid:
        raise ProviderException("Gemini API key validation failed", status_code=400)

    return {
        "ok": True,
        "message": "Gemini API key is valid and connected",
    }


# Models Discovery & Registry Endpoints
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
    discovered = provider.list_models(key)
    save_cached_models(conn, discovered)
    return {
        "models": discovered,
        "connected": True,
    }


@router.get("/models", response_model=ModelsListResponse)
def get_models(
    conn: sqlite3.Connection = Depends(get_db),
    _token: str = Depends(verify_token),
) -> dict[str, Any]:
    """Return cached models from SQLite or empty list with connected:false if no key."""
    key = load_gemini_key()
    if not key:
        return {
            "models": [],
            "connected": False,
        }

    cached = get_cached_models(conn)
    return {
        "models": cached,
        "connected": True,
    }
