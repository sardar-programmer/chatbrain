"""Security utilities for Chat-Brain backend."""

import hmac
import secrets
from fastapi import Header, Request
from app.config import get_settings
from app.errors import AuthException, ValidationException

TOKEN_HEADER_NAME = "X-ChatBrain-Token"

_startup_token: str = secrets.token_hex(32)


def get_startup_token() -> str:
    """Return the current per-startup security token."""
    global _startup_token
    return _startup_token


def reset_startup_token() -> str:
    """Generate and return a new startup token (useful in tests/restarts)."""
    global _startup_token
    _startup_token = secrets.token_hex(32)
    return _startup_token


def verify_host_header(host: str | None) -> None:
    """Validate that request Host is localhost or 127.0.0.1."""
    if not host:
        raise ValidationException("Missing Host header")

    hostname = host.split(":")[0].strip().lower()
    allowed = set(get_settings().allowed_hosts)
    if hostname not in allowed:
        raise ValidationException(f"Invalid Host header: {host}")


def verify_token(
    request: Request,
    x_chatbrain_token: str | None = Header(default=None, alias=TOKEN_HEADER_NAME),
) -> str:
    """Verify incoming X-ChatBrain-Token matches the startup token."""
    expected = get_startup_token()
    if not x_chatbrain_token or not hmac.compare_digest(x_chatbrain_token, expected):
        raise AuthException("Unauthorized: invalid or missing X-ChatBrain-Token")
    return x_chatbrain_token
