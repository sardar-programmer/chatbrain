"""Tests for safety blocking and throttled writes during chat streaming (M1.3b)."""

from typing import Any
from fastapi.testclient import TestClient
from app.db.database import create_connection
from app.services.ai.provider import StreamChunk
from app.services.chat import chat_store
from app.services.default_model import set_default_chat_model
from app.services.key_store import save_gemini_key
from app.services.model_registry import save_cached_models
from tests.conftest import FIXTURE_MODELS, FakeProvider


def setup_chat(conn: Any) -> tuple[str, str]:
    """Helper to save Gemini key, set default model, and create a conversation."""
    save_gemini_key("valid-secret-key-1234567890")
    save_cached_models(conn, FIXTURE_MODELS)
    set_default_chat_model(conn, "gemini-2.5-flash")
    conv = chat_store.create_conversation(conn, "Safety/Throttle Chat")
    return conv["id"], "gemini-2.5-flash"


def test_safety_blocked_chunk(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id, _ = setup_chat(conn)

    fake_provider.chunks_to_stream = [
        StreamChunk(text="Some text", finish_reason="SAFETY"),
    ]

    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Trigger safety block"},
        headers=headers,
    )

    from tests.test_chat_streaming import parse_sse
    events = parse_sse(res.text)
    error_events = [e[1] for e in events if e[0] == "error"]
    assert len(error_events) == 1
    assert error_events[0]["code"] == "safety_blocked"
    assert error_events[0]["retryable"] is False

    conv = chat_store.get_conversation(conn, conv_id)
    assert conv is not None
    assert conv["messages"][-1]["status"] == "error"
    assert conv["messages"][-1]["error_category"] == "safety_blocked"


def test_throttled_db_writes_during_streaming(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
    monkeypatch: Any,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id, _ = setup_chat(conn)

    # 100 fast chunks
    fake_provider.chunks_to_stream = [StreamChunk(text=f"word{i} ") for i in range(100)]

    import app.services.chat.chat_streamer as streamer
    real_create_connection = streamer.create_connection
    write_count = 0

    class ConnectionWrapper:
        def __init__(self, real_conn: Any):
            self._conn = real_conn

        def execute(self, sql: str, *args: Any, **kwargs: Any) -> Any:
            nonlocal write_count
            if "UPDATE messages SET content =" in str(sql):
                write_count += 1
            return self._conn.execute(sql, *args, **kwargs)

        def __getattr__(self, name: str) -> Any:
            return getattr(self._conn, name)

    monkeypatch.setattr(streamer, "create_connection", lambda: ConnectionWrapper(real_create_connection()))

    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Test throttling"},
        headers=headers,
    )
    assert res.status_code == 200

    # Writes during fast 100-chunk stream should be far fewer than 100 due to 300ms throttling
    assert write_count < 10
