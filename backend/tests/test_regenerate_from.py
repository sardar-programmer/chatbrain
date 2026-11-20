"""Tests for regenerate_from functionality (M1.4c)."""

import json
from typing import Any
from fastapi.testclient import TestClient
from app.db.database import create_connection
from app.services.ai.provider import StreamChunk
from app.services.chat import chat_store
from app.services.chat.chat_stream_session import _active_locks
from app.services.key_store import save_gemini_key
from app.services.model_registry import save_cached_models
from tests.conftest import FIXTURE_MODELS, FakeProvider


def parse_sse(text: str) -> list[tuple[str, dict[str, Any]]]:
    events: list[tuple[str, dict[str, Any]]] = []
    blocks = [b.strip() for b in text.strip().split("\n\n") if b.strip()]
    for block in blocks:
        if block.startswith(": ping"):
            continue
        lines = block.split("\n")
        event_name = "message"
        data_str = ""
        for line in lines:
            if line.startswith("event:"):
                event_name = line.split(":", 1)[1].strip()
            elif line.startswith("data:"):
                data_str = line.split(":", 1)[1].strip()
        if data_str:
            try:
                events.append((event_name, json.loads(data_str)))
            except json.JSONDecodeError:
                pass
    return events


def seed_multi_turn_conversation(conn: Any) -> tuple[str, list[dict[str, Any]]]:
    save_gemini_key("valid-secret-key-1234567890")
    save_cached_models(conn, FIXTURE_MODELS)
    conv = chat_store.create_conversation(conn, "Multi-turn Test")
    c_id = conv["id"]

    # Turn 1: user 1 -> asst 1
    u1 = chat_store.add_user_message(conn, c_id, "User question 1")
    a1 = chat_store.create_assistant_message(conn, c_id)
    chat_store.update_assistant_message(conn, a1["id"], content="Answer 1", status="done")

    # Turn 2: user 2 -> asst 2
    u2 = chat_store.add_user_message(conn, c_id, "User question 2")
    a2 = chat_store.create_assistant_message(conn, c_id)
    chat_store.update_assistant_message(conn, a2["id"], content="Answer 2", status="done")

    # Turn 3: user 3 -> asst 3
    u3 = chat_store.add_user_message(conn, c_id, "User question 3")
    a3 = chat_store.create_assistant_message(conn, c_id)
    chat_store.update_assistant_message(conn, a3["id"], content="Answer 3", status="done")

    return c_id, [u1, a1, u2, a2, u3, a3]


def test_regenerate_middle_answer_removes_later_and_answers_previous(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id, msgs = seed_multi_turn_conversation(conn)
    u1, a1, u2, a2, u3, a3 = msgs

    fake_provider.chunks_to_stream = [StreamChunk(text="Regenerated Answer 2")]

    # Regenerate from middle answer: a2
    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"regenerate_from": a2["id"]},
        headers=headers,
    )
    assert res.status_code == 200

    events = parse_sse(res.text)
    event_names = [e[0] for e in events]
    assert "message_created" in event_names
    assert "done" in event_names

    # Verify that message_created user_message_id is u2
    created_evt = next(e[1] for e in events if e[0] == "message_created")
    assert created_evt["user_message_id"] == u2["id"]

    # Verify DB state: a2, u3, a3 are GONE!
    c = chat_store.get_conversation(conn, conv_id)
    remaining_ids = [m["id"] for m in c["messages"]]
    assert u1["id"] in remaining_ids
    assert a1["id"] in remaining_ids
    assert u2["id"] in remaining_ids
    assert a2["id"] not in remaining_ids
    assert u3["id"] not in remaining_ids
    assert a3["id"] not in remaining_ids

    # New assistant message exists after u2
    last_msg = c["messages"][-1]
    assert last_msg["role"] == "assistant"
    assert last_msg["content"] == "Regenerated Answer 2"

    # Lock is released
    assert conv_id not in _active_locks


def test_regenerate_from_invalid_foreign_and_user_message_ids(
    authed_client: tuple[TestClient, dict[str, str]],
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id, msgs = seed_multi_turn_conversation(conn)
    u1, a1, u2, a2, u3, a3 = msgs

    # 1. Unknown message id -> 404
    res_unknown = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"regenerate_from": "00000000-0000-0000-0000-000000000000"},
        headers=headers,
    )
    assert res_unknown.status_code == 404
    assert conv_id not in _active_locks

    # 2. Foreign message id (belongs to another conversation) -> 422
    other_conv = chat_store.create_conversation(conn, "Other")
    chat_store.add_user_message(conn, other_conv["id"], "Other Q")
    foreign_a = chat_store.create_assistant_message(conn, other_conv["id"])
    chat_store.update_assistant_message(conn, foreign_a["id"], content="Other A", status="done")
    res_foreign = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"regenerate_from": foreign_a["id"]},
        headers=headers,
    )
    assert res_foreign.status_code == 422
    assert conv_id not in _active_locks

    # 3. User message id -> 422 (can only regenerate from assistant message)
    res_user = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"regenerate_from": u2["id"]},
        headers=headers,
    )
    assert res_user.status_code == 422
    assert conv_id not in _active_locks

    # 4. Mutually exclusive parameters -> 422
    res_mut = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "hello", "regenerate_from": a2["id"]},
        headers=headers,
    )
    assert res_mut.status_code == 422


def test_regenerate_from_concurrent_call_returns_409(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id, msgs = seed_multi_turn_conversation(conn)
    _u1, _a1, _u2, a2, _u3, _a3 = msgs

    from app.services.chat.chat_stream_session import acquire_stream_lock, release_stream_lock

    owner = acquire_stream_lock(conv_id)
    try:
        res = client.post(
            f"/api/v1/conversations/{conv_id}/reply",
            json={"regenerate_from": a2["id"]},
            headers=headers,
        )
        assert res.status_code == 409
    finally:
        release_stream_lock(conv_id, owner)
