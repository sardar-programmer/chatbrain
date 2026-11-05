"""Unit tests for provider error classification (M1.3b)."""

import pytest
from app.services.ai.error_classifier import (
    RETRYABLE_CODES,
    classify_provider_error,
)


@pytest.mark.parametrize(
    ("err_input", "expected_code", "expected_retryable"),
    [
        ("API key not valid. Please pass a valid API key.", "invalid_key", False),
        ("Invalid Gemini API key", "invalid_key", False),
        ("Resource_Exhausted: quota exceeded for model", "quota", True),
        ("Rate limit reached: please try again", "quota", True),
        ("Service is temporarily unavailable (503)", "unavailable", True),
        ("Upstream overloaded, please retry", "unavailable", True),
        ("Model 'gemini-nonexistent' not found (404)", "not_found", True),
        ("The operation timed out while waiting for upstream", "timeout", True),
        ("Connection reset by peer", "network", True),
        ("Socket error connecting to host", "network", True),
        ("Response was blocked by safety filters (SAFETY)", "safety_blocked", False),
        ("Candidate finish_reason: block_reason safety", "safety_blocked", False),
        ("Bad request: invalid argument in contents", "bad_request", False),
        ("Something completely unexpected happened", "unknown", False),
    ],
)
def test_classify_provider_error_table(
    err_input: str,
    expected_code: str,
    expected_retryable: bool,
) -> None:
    classified = classify_provider_error(err_input)
    assert classified.code == expected_code
    assert classified.retryable is expected_retryable
    assert classified.message
    # Never leak raw input in the sanitized message
    assert "gemini-nonexistent" not in classified.message
    assert "socket" not in classified.message


def test_all_codes_covered_in_retryable_table() -> None:
    expected_codes = {
        "invalid_key",
        "quota",
        "unavailable",
        "not_found",
        "timeout",
        "network",
        "safety_blocked",
        "bad_request",
        "unknown",
    }
    assert set(RETRYABLE_CODES.keys()) == expected_codes
