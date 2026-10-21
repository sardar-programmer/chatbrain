"""Default chat model selection logic (stored in settings, computed at read time)."""

import sqlite3
from app.services.ai.provider import derive_kind
from app.services.model_registry import get_cached_models
from app.services.settings_store import (
    SETTING_DEFAULT_CHAT_MODEL,
    delete_setting,
    get_setting,
    put_setting,
)


def _resolve_default_chat_model(
    conn: sqlite3.Connection,
    model_id: str | None,
    key_configured: bool,
) -> dict:
    """Compute validity and reason for the currently saved default chat model."""
    if model_id is None:
        return {"model_id": None, "valid": False, "reason": None}

    if not key_configured:
        return {"model_id": model_id, "valid": False, "reason": "no_key"}

    cached = get_cached_models(conn)
    match = next((m for m in cached if m.id == model_id), None)

    if match is None:
        return {"model_id": model_id, "valid": False, "reason": "model_not_found"}

    kind_result = derive_kind(match.id, match.supported_actions, list(match.capabilities))
    if kind_result.kind != "chat":
        return {"model_id": model_id, "valid": False, "reason": "not_a_chat_model"}

    return {"model_id": model_id, "valid": True, "reason": None}


def get_default_chat_model_status(
    conn: sqlite3.Connection,
    key_configured: bool,
) -> dict:
    """Return {model_id, valid, reason} for the currently saved default chat model."""
    model_id = get_setting(conn, SETTING_DEFAULT_CHAT_MODEL)
    return _resolve_default_chat_model(conn, model_id, key_configured)


def set_default_chat_model(
    conn: sqlite3.Connection,
    model_id: str,
    force: bool = False,
) -> dict:
    """Validate and save the default chat model choice. Returns same shape as GET."""
    from app.errors import NotFoundException, ValidationException

    cached = get_cached_models(conn)
    match = next((m for m in cached if m.id == model_id), None)

    if match is None:
        raise NotFoundException(f"Model '{model_id}' not found in the cached model list")

    kind_result = derive_kind(match.id, match.supported_actions, list(match.capabilities))
    if kind_result.kind != "chat" and not force:
        raise ValidationException(
            f"Model '{model_id}' has kind '{kind_result.kind}', not 'chat'. "
            f"Use force=true to override."
        )

    put_setting(conn, SETTING_DEFAULT_CHAT_MODEL, model_id)
    return {"model_id": model_id, "valid": True, "reason": None}


def clear_default_chat_model(conn: sqlite3.Connection) -> dict:
    """Remove the default chat model selection."""
    delete_setting(conn, SETTING_DEFAULT_CHAT_MODEL)
    return {"model_id": None, "valid": False, "reason": None}
