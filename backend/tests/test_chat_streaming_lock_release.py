"""Tests for stream lock release across exit paths, concurrency, and leak recovery (M1.3b FIX)."""

import concurrent.futures
import gc
from typing import Any
import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request
from app.db.database import create_connection
from app.services.ai.provider import StreamChunk
from app.services.chat import chat_store
from app.services.chat.chat_stream_session import _active_locks, acquire_stream_lock
from app.services.chat.chat_streamer import stream_reply_events
from app.services.key_store import save_gemini_key
from app.services.model_registry import save_cached_models
from tests.conftest import FIXTURE_MODELS, FakeProvider
from tests.test_chat_streaming import parse_sse


def setup_chat(conn: Any, title: str) -> str:
    """Helper setting up credentials, models, and conversation."""
    save_gemini_key("valid-secret-key-1234567890")
    save_cached_models(conn, FIXTURE_MODELS)
    conv = chat_store.create_conversation(conn, title)
    return conv["id"]


def test_lock_released_after_provider_error_mid_stream(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id = setup_chat(conn, "Mid Stream Error Chat")

    fake_provider.chunks_to_stream = [StreamChunk(text="Chunk 1"), StreamChunk(text="Chunk 2")]
    fake_provider.stream_error = RuntimeError("RESOURCE_EXHAUSTED")
    fake_provider.stream_error_after_chunks = 1

    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Trigger error"},
        headers=headers,
    )
    assert res.status_code == 200
    events = parse_sse(res.text)
    assert any(e[0] == "error" for e in events)

    fake_provider.stream_error = None
    fake_provider.chunks_to_stream = [StreamChunk(text="Recovered answer")]
    res2 = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Retry message"},
        headers=headers,
    )
    assert res2.status_code == 200


def test_lock_released_after_first_chunk_timeout(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id = setup_chat(conn, "Timeout Release Chat")

    import app.services.chat.chat_streamer as streamer
    monkeypatch.setattr(streamer, "FIRST_CHUNK_TIMEOUT_SECONDS", 0.05)
    monkeypatch.setattr(streamer, "PING_INTERVAL_SECONDS", 0.02)
    fake_provider.chunks_to_stream = [StreamChunk(text="Slow")]
    fake_provider.stream_delay = 0.2

    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Cause timeout"},
        headers=headers,
    )
    events = parse_sse(res.text)
    assert any(e[0] == "error" for e in events)

    monkeypatch.setattr(streamer, "FIRST_CHUNK_TIMEOUT_SECONDS", 30.0)
    fake_provider.stream_delay = 0.0
    from app.services.ai.model_health import get_health_store
    for h in get_health_store().all().values():
        h.cooldown_until = None
    res2 = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Next turn"},
        headers=headers,
    )
    assert res2.status_code == 200


def test_lock_released_after_safety_block(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id = setup_chat(conn, "Safety Block Chat")

    fake_provider.chunks_to_stream = [StreamChunk(text="Blocked text", finish_reason="SAFETY")]
    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Trigger safety"},
        headers=headers,
    )
    events = parse_sse(res.text)
    assert any(e[0] == "error" and e[1].get("code") == "safety_blocked" for e in events)

    fake_provider.chunks_to_stream = [StreamChunk(text="Safe text")]
    res2 = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Safe turn"},
        headers=headers,
    )
    assert res2.status_code == 200


def test_lock_released_after_generator_garbage_collected(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id = setup_chat(conn, "GC Stream Chat")

    owner = acquire_stream_lock(conv_id)
    scope = {"type": "http", "method": "POST", "path": "/"}
    req = Request(scope)

    user_msg = chat_store.add_user_message(conn, conv_id, "GC test message")
    gen = stream_reply_events(conv_id, user_msg["id"], req, owner=owner)
    owner.set_generator(gen)

    del gen
    gc.collect()

    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Turn after GC"},
        headers=headers,
    )
    assert res.status_code == 200


def test_two_truly_concurrent_replies_return_409(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id = setup_chat(conn, "Truly Concurrent Chat")

    fake_provider.chunks_to_stream = [StreamChunk(text=f"word{i} ") for i in range(10)]
    fake_provider.stream_delay = 0.05

    def send_reply(msg: str) -> int:
        r = client.post(
            f"/api/v1/conversations/{conv_id}/reply",
            json={"content": msg},
            headers=headers,
        )
        return r.status_code

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(send_reply, "Concurrent 1")
        f2 = executor.submit(send_reply, "Concurrent 2")
        statuses = {f1.result(), f2.result()}

    assert 200 in statuses
    assert 409 in statuses


def test_leaked_lock_whose_owner_is_finished_is_treated_as_free(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id = setup_chat(conn, "Leaked Finished Lock Chat")

    owner = acquire_stream_lock(conv_id)
    owner.mark_finished()
    assert conv_id in _active_locks
    assert not owner.is_running()

    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "New turn after leak"},
        headers=headers,
    )
    assert res.status_code == 200
