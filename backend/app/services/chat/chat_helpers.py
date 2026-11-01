"""Helpers for Chat: UUID validation, cursor pagination, and safe JSON parsing."""

import base64
import json
import logging
from typing import Any
import uuid
from app.errors import ValidationException

logger = logging.getLogger("chatbrain.chat.helpers")


def validate_uuid(value: str) -> str:
    """Validate that value is a valid UUID string. Raises 422 if invalid."""
    try:
        parsed = uuid.UUID(value)
        return str(parsed)
    except (ValueError, TypeError, AttributeError):
        raise ValidationException(f"Invalid UUID: {value}", status_code=422)


def safe_json_loads(value: str | None, column_name: str) -> Any:
    """Safely parse JSON column; logs column on failure without leaking content."""
    if not value:
        return None
    try:
        return json.loads(value)
    except Exception:
        logger.warning("Failed to parse JSON column '%s'", column_name)
        return None


def encode_cursor(pinned: int, updated_at: str, item_id: str) -> str:
    """Encode pagination cursor into an opaque URL-safe string."""
    raw = f"{pinned}|{updated_at}|{item_id}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("utf-8")


def decode_cursor(cursor_str: str) -> tuple[int, str, str]:
    """Decode pagination cursor into (pinned, updated_at, id). Raises 422 if invalid."""
    try:
        raw = base64.urlsafe_b64decode(cursor_str.encode("utf-8")).decode("utf-8")
        parts = raw.split("|", 2)
        if len(parts) != 3:
            raise ValueError("Malformed cursor format")
        pinned = int(parts[0])
        updated_at = parts[1]
        item_id = str(uuid.UUID(parts[2]))
        return pinned, updated_at, item_id
    except Exception:
        raise ValidationException("Invalid pagination cursor", status_code=422)
