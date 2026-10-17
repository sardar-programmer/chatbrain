"""API routes for Chat-Brain backend (v1)."""

import sqlite3
from typing import Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from app.config import get_settings
from app.db.database import check_db_health, get_db
from app.security import get_startup_token, verify_token

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
