"""Security utilities for Chat-Brain backend."""

import hmac
import secrets
from fastapi import Request, Security
from fastapi.security import APIKeyHeader
from app.config import get_settings
from app.errors import AuthException, ValidationException

TOKEN_HEADER_NAME = "X-ChatBrain-Token"

api_key_header = APIKeyHeader(
    name=TOKEN_HEADER_NAME,
    auto_error=False,
    description="Chat-Brain ephemeral startup token",
)

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
    token_from_header: str | None = Security(api_key_header),
) -> str:
    """Verify incoming X-ChatBrain-Token matches the startup token."""
    expected = get_startup_token()
    if not token_from_header or not hmac.compare_digest(token_from_header, expected):
        raise AuthException("Unauthorized: invalid or missing X-ChatBrain-Token")
    return token_from_header
