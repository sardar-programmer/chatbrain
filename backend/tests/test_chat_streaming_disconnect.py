"""Tests for stream disconnect, partial content preservation, and upstream cancellation (M1.3b FIX)."""

from typing import Any
import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request
from app.db.database import create_connection
from app.services.ai.provider import StreamChunk
from app.services.chat import chat_store
from app.services.chat.chat_stream_session import _active_locks, acquire_stream_lock
from app.services.chat.chat_streamer import stream_reply_events
from app.services.default_model import set_default_chat_model
from app.services.key_store import save_gemini_key
from app.services.model_registry import save_cached_models
from tests.conftest import FIXTURE_MODELS, FakeProvider
from tests.test_chat_streaming import parse_sse


def setup_chat(conn: Any, title: str) -> str:
    """Helper setting up credentials, models, and conversation."""
    save_gemini_key("valid-secret-key-1234567890")
    save_cached_models(conn, FIXTURE_MODELS)
    set_default_chat_model(conn, "gemini-2.5-flash")
    conv = chat_store.create_conversation(conn, title)
    return conv["id"]


def test_client_disconnect_stops_message_and_releases_lock(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id = setup_chat(conn, "Disconnect & Next Reply")

    fake_provider.chunks_to_stream = [
        StreamChunk(text="Chunk 1 "),
        StreamChunk(text="Chunk 2 "),
        StreamChunk(text="Chunk 3 "),
        StreamChunk(text="Chunk 4 "),
    ]

    disconnect_triggered = False
    call_count = 0

    async def mock_is_disconnected(self: Any) -> bool:
        nonlocal call_count, disconnect_triggered
        call_count += 1
        if not disconnect_triggered and call_count >= 2:
            disconnect_triggered = True
            return True
        return False

    monkeypatch.setattr(Request, "is_disconnected", mock_is_disconnected)

    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "First turn"},
        headers=headers,
    )
    assert res.status_code == 200

    # Upstream provider generator was closed/cancelled promptly:
    assert fake_provider.stream_closed is True

    # Assert message is 'stopped' with partial content:
    conv = chat_store.get_conversation(conn, conv_id)
    assert conv is not None
    asst_msg = conv["messages"][-1]
    assert asst_msg["status"] == "stopped"
    assert "Chunk 1" in asst_msg["content"]
    assert "Chunk 4" not in asst_msg["content"]

    # Immediate second reply succeeds without 409:
    fake_provider.chunks_to_stream = [StreamChunk(text="Followup answer")]
    fake_provider.stream_delay = 0.0
    res2 = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Second turn"},
        headers=headers,
    )
    assert res2.status_code == 200
    events = parse_sse(res2.text)
    assert any(e[0] == "done" for e in events)


def test_regenerate_right_after_stop_succeeds(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id = setup_chat(conn, "Regen After Stop")

    fake_provider.chunks_to_stream = [
        StreamChunk(text="Part 1 "),
        StreamChunk(text="Part 2 "),
        StreamChunk(text="Part 3 "),
    ]

    disconnect_triggered = False
    call_count = 0

    async def mock_is_disconnected(self: Any) -> bool:
        nonlocal call_count, disconnect_triggered
        call_count += 1
        if not disconnect_triggered and call_count >= 2:
            disconnect_triggered = True
            return True
        return False

    monkeypatch.setattr(Request, "is_disconnected", mock_is_disconnected)

    client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Question to be stopped"},
        headers=headers,
    )

    conv = chat_store.get_conversation(conn, conv_id)
    assert conv is not None
    assert conv["messages"][-1]["status"] == "stopped"

    # Immediate regenerate succeeds without 409:
    fake_provider.chunks_to_stream = [StreamChunk(text="Fully regenerated answer")]
    res_regen = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"regenerate": True},
        headers=headers,
    )
    assert res_regen.status_code == 200
    events = parse_sse(res_regen.text)
    assert any(e[0] == "done" for e in events)

    conv_after = chat_store.get_conversation(conn, conv_id)
    assert conv_after is not None
    assert conv_after["messages"][-1]["status"] == "done"
    assert conv_after["messages"][-1]["content"] == "Fully regenerated answer"


@pytest.mark.anyio
async def test_generator_exit_via_aclose_stops_message_and_releases_lock(
    fake_provider: FakeProvider,
) -> None:
    conn = create_connection()
    conv_id = setup_chat(conn, "aclose Stop Chat")

    owner = acquire_stream_lock(conv_id)
    scope = {"type": "http", "method": "POST", "path": "/"}
    async def dummy_receive() -> dict[str, str]:
        return {"type": "http.request"}
    req = Request(scope, receive=dummy_receive)

    user_msg = chat_store.add_user_message(conn, conv_id, "Direct aclose test")
    gen = stream_reply_events(conv_id, user_msg["id"], req, owner=owner)
    owner.set_generator(gen)

    # Consume until writing/delta so stream_chat has started
    async for event in gen:
        if "writing" in event or "delta" in event:
            break

    # Close generator directly (raises GeneratorExit)
    await gen.aclose()

    # Lock was released and owner is no longer running
    assert not owner.is_running()
    assert conv_id not in _active_locks

    # Upstream stream was closed
    assert fake_provider.stream_closed is True

    # Assistant message is marked stopped
    conv = chat_store.get_conversation(conn, conv_id)
    assert conv["messages"][-1]["status"] == "stopped"
