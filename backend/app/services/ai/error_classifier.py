"""Provider error classification and retryability rules (M1.3b)."""

from dataclasses import dataclass
from typing import Any

# Allowed error codes as defined in requirements
RETRYABLE_CODES = {
    "quota": True,
    "unavailable": True,
    "not_found": True,
    "timeout": True,
    "network": True,
    "invalid_key": False,
    "safety_blocked": False,
    "bad_request": False,
    "unknown": False,
}

ERROR_MESSAGES = {
    "invalid_key": "Your Gemini API key is invalid or has expired. Please check your key in API Management.",
    "quota": "Gemini API rate limit or quota exceeded. Please wait a moment and try again.",
    "unavailable": "The Gemini AI service is temporarily unavailable. Please try again shortly.",
    "not_found": "The requested AI model was not found or is unavailable for this API key.",
    "timeout": "The request to the AI model timed out. Please try again.",
    "network": "Network error while communicating with the Gemini API.",
    "safety_blocked": "The response was blocked by safety filters.",
    "bad_request": "Invalid request sent to the AI provider.",
    "unknown": "An unexpected error occurred while communicating with the AI provider.",
}


@dataclass(frozen=True)
class ClassifiedError:
    """Classified error metadata."""

    code: str
    retryable: bool
    message: str


def classify_provider_error(exc: Any) -> ClassifiedError:
    """Classify an exception or error string into standard code, retryable flag, and message."""
    if isinstance(exc, ClassifiedError):
        return exc

    err_str = str(exc).lower() if exc is not None else ""
    code_attr = getattr(exc, "code", None)
    status_attr = getattr(exc, "status_code", None)
    http_code = code_attr or status_attr

    # 1. Invalid key / Auth errors
    if (
        "api key not valid" in err_str
        or "invalid api key" in err_str
        or ("invalid" in err_str and "key" in err_str)
        or "api_key_invalid" in err_str
        or "invalid_key" in err_str
        or http_code == 401
    ):
        code = "invalid_key"

    # 2. Safety block
    elif "safety" in err_str or "block_reason" in err_str or "safety_blocked" in err_str:
        code = "safety_blocked"

    # 3. Quota / Rate limit
    elif (
        "resource_exhausted" in err_str
        or "quota" in err_str
        or "rate limit" in err_str
        or http_code == 429
    ):
        code = "quota"

    # 4. Model not found
    elif "not found" in err_str or "not_found" in err_str or http_code == 404:
        code = "not_found"

    # 5. Timeout
    elif (
        "timeout" in err_str
        or "timed out" in err_str
        or isinstance(exc, (TimeoutError,))
        or http_code in (408, 504)
    ):
        code = "timeout"

    # 6. Service unavailable / Server errors
    elif (
        "unavailable" in err_str
        or "overloaded" in err_str
        or "server error" in err_str
        or http_code in (502, 503)
    ):
        code = "unavailable"

    # 7. Network / connection
    elif (
        "connection" in err_str
        or "network" in err_str
        or "socket" in err_str
        or isinstance(exc, (ConnectionError,))
    ):
        code = "network"

    # 8. Bad request
    elif "bad request" in err_str or "invalid argument" in err_str or http_code == 400:
        code = "bad_request"

    # 9. Fallback
    else:
        code = "unknown"

    return ClassifiedError(
        code=code,
        retryable=RETRYABLE_CODES[code],
        message=ERROR_MESSAGES[code],
    )
