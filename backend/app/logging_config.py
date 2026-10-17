"""Structured logging configuration that scrubs sensitive secrets."""

import json
import logging
import re
from typing import Any

SECRET_PATTERNS = [
    re.compile(r'(?i)(["\']?(?:token|secret|password|api[_-]?key|authorization|x-chatbrain-token)["\']?\s*[:=]\s*["\'])([^"\']+)(["\'])'),
    re.compile(r'(?i)(bearer\s+)([A-Za-z0-9_\-\.]+)'),
]

SENSITIVE_KEYS = {
    "token",
    "secret",
    "password",
    "api_key",
    "authorization",
    "x-chatbrain-token",
}


def scrub_text(text: str) -> str:
    """Scrub sensitive patterns from text."""
    scrubbed = text
    for pattern in SECRET_PATTERNS:
        scrubbed = pattern.sub(r"\g<1>[REDACTED]\g<3>", scrubbed) if pattern.groups == 3 else pattern.sub(r"\g<1>[REDACTED]", scrubbed)
    return scrubbed


def sanitize_value(val: Any) -> Any:
    """Recursively sanitize data structures."""
    if isinstance(val, dict):
        return {
            k: ("[REDACTED]" if str(k).lower() in SENSITIVE_KEYS else sanitize_value(v))
            for k, v in val.items()
        }
    if isinstance(val, list):
        return [sanitize_value(v) for v in val]
    if isinstance(val, str):
        return scrub_text(val)
    return val


class SafeStructuredFormatter(logging.Formatter):
    """Formats log records as structured JSON without exposing secrets."""

    def format(self, record: logging.LogRecord) -> str:
        msg = record.getMessage()
        sanitized_msg = scrub_text(msg)

        payload: dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": sanitized_msg,
        }

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload)


def setup_logging(level: int = logging.INFO) -> None:
    """Configure root logger with structured safe formatter."""
    handler = logging.StreamHandler()
    handler.setFormatter(SafeStructuredFormatter())

    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.handlers = [handler]
