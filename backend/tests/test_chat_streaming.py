"""Integration tests for Chat streaming endpoint /api/v1/conversations/{id}/reply (M1.3b)."""

import json
from typing import Any
from fastapi.testclient import TestClient
from app.db.database import create_connection
from app.services.ai.provider import StreamChunk
from app.services.chat import chat_store
from app.services.default_model import set_default_chat_model
from app.services.key_store import save_gemini_key
from app.services.model_registry import save_cached_models
from tests.conftest import FIXTURE_MODELS, FakeProvider


def parse_sse(text: str) -> list[tuple[str, dict[str, Any]]]:
    """Parse raw SSE response into (event_name, data_dict) tuples."""
    events = []
    blocks = text.split("\n\n")
    for block in blocks:
        event_type = None
        data = None
        for line in block.split("\n"):
            line = line.strip()
            if line.startswith("event:"):
                event_type = line[len("event:"):].strip()
            elif line.startswith("data:"):
                raw_json = line[len("data:"):].strip()
                if raw_json:
                    data = json.loads(raw_json)
        if event_type:
            events.append((event_type, data or {}))
    return events


def setup_chat(conn: Any) -> tuple[str, str]:
    """Helper to save Gemini key, set default model, and create a conversation."""
    save_gemini_key("valid-secret-key-1234567890")
    save_cached_models(conn, FIXTURE_MODELS)
    set_default_chat_model(conn, "gemini-2.5-flash")
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
    assert names[2] == "status"
    assert events[2][1]["phase"] == "connecting"
    assert names[3] == "status"
    assert events[3][1]["phase"] == "waiting_first_token"
    assert names[4] == "status"
    assert events[4][1]["phase"] == "writing"

    # 2. Deltas joined equal saved content
    deltas = [e[1]["text"] for e in events if e[0] == "delta"]
    combined_text = "".join(deltas)
    assert combined_text == "Hello world!"

    # 3. Done event
    done_event = [e[1] for e in events if e[0] == "done"][0]
    assert done_event["status"] == "done"
    assert done_event["model_used"] == model_id

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

    # B. Key present, but no default model chosen
    save_gemini_key("valid-secret-key-1234567890")
    res_no_model = client.post(
        f"/api/v1/conversations/{conv['id']}/reply",
        json={"content": "Another message"},
        headers=headers,
    )
    events_no_model = parse_sse(res_no_model.text)
    assert events_no_model[0][0] == "error"
    assert events_no_model[0][1]["category"] == "model"


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


def test_regenerate_replaces_last_assistant_message(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id, _ = setup_chat(conn)

    # First turn
    fake_provider.chunks_to_stream = [StreamChunk(text="Initial answer")]
    client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Question"},
        headers=headers,
    )

    # Regenerate
    fake_provider.chunks_to_stream = [StreamChunk(text="Regenerated answer")]
    res_regen = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"regenerate": True},
        headers=headers,
    )
    events = parse_sse(res_regen.text)
    assert any(e[0] == "done" for e in events)

    conv = chat_store.get_conversation(conn, conv_id)
    assert conv is not None
    assert len(conv["messages"]) == 2  # still 1 user, 1 assistant
    assert conv["messages"][1]["content"] == "Regenerated answer"


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

