"""Tests for real Gemini streaming with Server-Sent Events (SSE) (M1.3b/M1.3c)."""

import json
from typing import Any
from fastapi.testclient import TestClient
from app.db.database import create_connection
from app.services.ai.provider import StreamChunk
from app.services.chat import chat_store
from app.services.key_store import save_gemini_key
from app.services.model_registry import save_cached_models
from tests.conftest import FIXTURE_MODELS, FakeProvider


def parse_sse(text: str) -> list[tuple[str, dict[str, Any]]]:
    """Parse raw SSE text into list of (event_type, json_data) tuples."""
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


def setup_chat(conn: Any) -> tuple[str, str]:
    """Helper to configure API key, models, and conversation."""
    save_gemini_key("valid-secret-key-1234567890")
    save_cached_models(conn, FIXTURE_MODELS)
    conv = chat_store.create_conversation(conn, "Stream Test")
    return conv["id"], "gemini-2.5-flash"


def test_normal_stream_flow_and_phases(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id, model_id = setup_chat(conn)

    fake_provider.chunks_to_stream = [
        StreamChunk(text="Hello"),
        StreamChunk(text=" world"),
        StreamChunk(text="!"),
    ]

    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Hi there"},
        headers=headers,
    )
    assert res.status_code == 200
    events = parse_sse(res.text)

    # 1. Event ordering: message_created -> status(preparing) -> status(connecting) ->
    # status(waiting_first_token) -> status(writing) -> delta... -> done
    names = [e[0] for e in events]
    assert names[0] == "message_created"
    assert names[1] == "status"
    assert events[1][1]["phase"] == "preparing"
    assert "model_id" not in events[1][1]
    assert names[2] == "status"
    assert events[2][1]["phase"] == "connecting"
    assert "model_id" not in events[2][1]
    assert names[3] == "status"
    assert events[3][1]["phase"] == "waiting_first_token"
    assert "model_id" not in events[3][1]
    assert names[4] == "status"
    assert events[4][1]["phase"] == "writing"
    assert "model_id" not in events[4][1]

    # 2. Deltas joined equal saved content
    deltas = [e[1]["text"] for e in events if e[0] == "delta"]
    combined_text = "".join(deltas)
    assert combined_text == "Hello world!"

    # 3. Done event
    done_event = [e[1] for e in events if e[0] == "done"][0]
    assert done_event["status"] == "done"
    assert "model_used" not in done_event

    # 4. DB verification
    conv = chat_store.get_conversation(conn, conv_id)
    assert conv is not None
    assert len(conv["messages"]) == 2
    user_msg, asst_msg = conv["messages"]
    assert user_msg["role"] == "user"
    assert user_msg["content"] == "Hi there"
    assert asst_msg["role"] == "assistant"
    assert asst_msg["content"] == "Hello world!"
    assert asst_msg["status"] == "done"
    assert asst_msg["model_used"] == model_id

    # 5. Verify system prompt was passed to provider
    assert len(fake_provider.recorded_calls) == 1
    assert "data-science tutor" in fake_provider.recorded_calls[0]["system_instruction"]


def test_missing_key_or_invalid_model_emits_error_before_assistant_msg(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv = chat_store.create_conversation(conn, "No Key Chat")

    # A. No key configured
    res_no_key = client.post(
        f"/api/v1/conversations/{conv['id']}/reply",
        json={"content": "Should save user msg but no assistant"},
        headers=headers,
    )
    events_no_key = parse_sse(res_no_key.text)
    assert len(events_no_key) == 1
    err_event = events_no_key[0]
    assert err_event[0] == "error"
    assert err_event[1]["code"] == "invalid_key"
    assert err_event[1]["message_id"] is None

    # User message exists, no assistant message
    conv_db = chat_store.get_conversation(conn, conv["id"])
    assert conv_db is not None
    assert len(conv_db["messages"]) == 1
    assert conv_db["messages"][0]["role"] == "user"

    # B. Key present, but empty pool (no chat model discovered)
    save_gemini_key("valid-secret-key-1234567890")
    fake_provider.models_to_return = []
    res_no_model = client.post(
        f"/api/v1/conversations/{conv['id']}/reply",
        json={"content": "Another message"},
        headers=headers,
    )
    events_no_model = parse_sse(res_no_model.text)
    assert events_no_model[0][0] == "error"
    assert events_no_model[0][1]["category"] == "model"
    assert "No chat model is available for your API key. Check the key in Settings." in events_no_model[0][1]["message"]


def test_reply_validation_without_content(
    authed_client: tuple[TestClient, dict[str, str]],
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv = chat_store.create_conversation(conn, "Empty Conv")

    # Reply with no content on empty conversation -> 422
    res_empty = client.post(
        f"/api/v1/conversations/{conv['id']}/reply",
        json={},
        headers=headers,
    )
    assert res_empty.status_code == 422
    assert res_empty.json()["error"]["category"] == "validation"


def test_regenerate_replaces_last_assistant_message(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id, _ = setup_chat(conn)

    # Initial reply
    fake_provider.chunks_to_stream = [StreamChunk(text="Initial answer")]
    res1 = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Initial question"},
        headers=headers,
    )
    assert res1.status_code == 200

    conv1 = chat_store.get_conversation(conn, conv_id)
    assert conv1 is not None
    first_asst_id = conv1["messages"][-1]["id"]
    assert conv1["messages"][-1]["content"] == "Initial answer"

    # Regenerate
    fake_provider.chunks_to_stream = [StreamChunk(text="New regenerated answer")]
    res2 = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"regenerate": True},
        headers=headers,
    )
    assert res2.status_code == 200

    conv2 = chat_store.get_conversation(conn, conv_id)
    assert conv2 is not None
    assert len(conv2["messages"]) == 2
    second_asst = conv2["messages"][-1]
    assert second_asst["id"] != first_asst_id
    assert second_asst["content"] == "New regenerated answer"


def test_mid_stream_provider_error_saves_partial_and_emits_error(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id, _ = setup_chat(conn)

    fake_provider.chunks_to_stream = [
        StreamChunk(text="First chunk "),
        StreamChunk(text="second chunk "),
    ]
    fake_provider.stream_error = RuntimeError("RESOURCE_EXHAUSTED quota exceeded")
    fake_provider.stream_error_after_chunks = 2

    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Cause quota error"},
        headers=headers,
    )
    events = parse_sse(res.text)

    # Error event emitted
    error_events = [e[1] for e in events if e[0] == "error"]
    assert len(error_events) == 1
    assert error_events[0]["code"] == "quota"
    assert error_events[0]["retryable"] is True

    # Partial content saved in DB with status error
    conv = chat_store.get_conversation(conn, conv_id)
    assert conv is not None
    asst_msg = conv["messages"][-1]
    assert asst_msg["status"] == "error"
    assert asst_msg["content"] == "First chunk second chunk "
    assert asst_msg["error_category"] == "quota"
