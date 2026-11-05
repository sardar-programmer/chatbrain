"""Tests for streaming timeouts, concurrency lock (409), and logging security (M1.3b)."""

import logging
from typing import Any
import pytest
from fastapi.testclient import TestClient
from app.db.database import create_connection
from app.services.ai.provider import StreamChunk
from app.services.chat import chat_store
from app.services.default_model import set_default_chat_model
from app.services.key_store import save_gemini_key
from app.services.model_registry import save_cached_models
from tests.conftest import FIXTURE_MODELS, FakeProvider


def parse_sse(text: str) -> list[tuple[str, dict[str, Any]]]:
    events = []
    for block in text.split("\n\n"):
        etype, edata = None, None
        for line in block.split("\n"):
            line = line.strip()
            if line.startswith("event:"):
                etype = line[len("event:"):].strip()
            elif line.startswith("data:"):
                raw = line[len("data:"):].strip()
                if raw:
                    import json
                    edata = json.loads(raw)
        if etype:
            events.append((etype, edata or {}))
    return events


def setup_chat(conn: Any, title: str) -> str:
    save_gemini_key("valid-secret-key-1234567890")
    save_cached_models(conn, FIXTURE_MODELS)
    set_default_chat_model(conn, "gemini-2.5-flash")
    conv = chat_store.create_conversation(conn, title)
    return conv["id"]


def test_first_chunk_timeout_emits_timeout_error(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id = setup_chat(conn, "Timeout Chat")

    # Set very short timeout for testing
    import app.services.chat.chat_streamer as streamer
    monkeypatch.setattr(streamer, "FIRST_CHUNK_TIMEOUT_SECONDS", 0.05)
    monkeypatch.setattr(streamer, "PING_INTERVAL_SECONDS", 0.02)

    fake_provider.chunks_to_stream = [StreamChunk(text="Too late")]
    fake_provider.stream_delay = 0.2  # greater than FIRST_CHUNK_TIMEOUT_SECONDS

    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Hello slow model"},
        headers=headers,
    )
    events = parse_sse(res.text)
    error_events = [e[1] for e in events if e[0] == "error"]
    assert len(error_events) == 1
    assert error_events[0]["code"] == "timeout"
    assert error_events[0]["retryable"] is True


def test_concurrent_reply_returns_409(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id = setup_chat(conn, "Lock Chat")

    import app.services.chat.chat_streamer as streamer

    # Simulate an already-active stream for this conversation
    streamer._active_conversations.add(conv_id)
    try:
        res = client.post(
            f"/api/v1/conversations/{conv_id}/reply",
            json={"content": "Concurrent message"},
            headers=headers,
        )
        assert res.status_code == 409
        err = res.json()["error"]
        assert err["category"] == "conflict"
        assert "already streaming" in err["message"]
    finally:
        streamer._active_conversations.discard(conv_id)


def test_logs_never_leak_user_text_or_api_key(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
    caplog: pytest.LogCaptureFixture,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    secret_key = "valid-secret-key-1234567890"
    user_secret_text = "MY_VERY_SECRET_PASSCODE_9999"

    save_gemini_key(secret_key)
    save_cached_models(conn, FIXTURE_MODELS)
    set_default_chat_model(conn, "gemini-2.5-flash")
    conv = chat_store.create_conversation(conn, "Security Log Chat")

    fake_provider.chunks_to_stream = [StreamChunk(text="Response")]

    with caplog.at_level(logging.DEBUG):
        res = client.post(
            f"/api/v1/conversations/{conv['id']}/reply",
            json={"content": user_secret_text},
            headers=headers,
        )
        assert res.status_code == 200

    all_logs = " ".join(record.message for record in caplog.records)
    assert secret_key not in all_logs
    assert user_secret_text not in all_logs


def test_client_disconnect_marks_message_stopped(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from starlette.requests import Request
    client, headers = authed_client
    conn = create_connection()
    conv_id = setup_chat(conn, "Disconnect Chat")

    fake_provider.chunks_to_stream = [
        StreamChunk(text="Chunk 1"),
        StreamChunk(text="Chunk 2"),
    ]

    call_count = 0
    async def mock_is_disconnected(self: Any) -> bool:
        nonlocal call_count
        call_count += 1
        return call_count >= 2

    monkeypatch.setattr(Request, "is_disconnected", mock_is_disconnected)

    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Disconnect test"},
        headers=headers,
    )
    events = parse_sse(res.text)
    assert any(e[0] == "stopped" for e in events)

    conv_db = chat_store.get_conversation(conn, conv_id)
    assert conv_db is not None
    asst = conv_db["messages"][-1]
    assert asst["status"] == "stopped"
