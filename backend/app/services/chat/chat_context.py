"""Chat context building utilities (M1.3b)."""

from typing import Any


def build_chat_context(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build sanitized chat context for the AI provider.

    Rules:
    - Drop assistant messages with status 'error' that have empty content.
    - Drop any message with empty or whitespace-only content.
    - Include partial ('stopped') assistant text.
    - Keep the LAST 30 messages.
    - Ensure the context starts with a user message (drop leading assistant messages).
    - Map roles: user -> 'user', assistant -> 'model'.
    """
    valid: list[dict[str, Any]] = []

    for msg in messages:
        content = (msg.get("content") or "").strip()
        role = msg.get("role", "")
        status = msg.get("status", "")

        # Drop assistant error messages with empty content
        if role == "assistant" and status == "error" and not content:
            continue

        # Drop any message with empty content
        if not content:
            continue

        valid.append({
            "role": "model" if role == "assistant" else "user",
            "content": msg.get("content", ""),
            "parts": [{"text": msg.get("content", "")}],
        })

    # Keep last 30 messages
    windowed = valid[-30:]

    # Ensure list starts with a user message
    while windowed and windowed[0]["role"] != "user":
        windowed.pop(0)

    return windowed
