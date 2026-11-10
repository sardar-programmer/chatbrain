"""Integration tests for model failover, default routing, and non-retryable blocks (M1.3c)."""

import logging
from typing import Any
import pytest
from fastapi.testclient import TestClient
from app.db.database import create_connection
from app.errors import ProviderException
from app.services.ai.model_health import get_health_store
from app.services.ai.provider import StreamChunk
from app.services.chat import chat_store
from app.services.chat.failover_config import FailoverConfig, set_failover_config
from app.services.chat.failover_events import get_failover_events
from app.services.key_store import save_gemini_key
from app.services.model_registry import save_cached_models
from tests.conftest import FIXTURE_MODELS, FakeProvider, ModelScript, _m
from tests.test_chat_streaming import parse_sse


def setup_multi_model_chat(conn: Any) -> str:
    save_gemini_key("valid-secret-key-1234567890")
    models = [
        _m("model-alpha", "Model Alpha", ["generateContent"], ["text"]),
        _m("model-beta", "Model Beta", ["generateContent"], ["text"]),
        _m("model-gamma", "Model Gamma", ["generateContent"], ["text"]),
    ]
    save_cached_models(conn, models)
    conv = chat_store.create_conversation(conn, "Failover Chat")
    return conv["id"]


def test_default_ok_no_switch(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id = setup_multi_model_chat(conn)

    fake_provider.model_scripts["model-alpha"] = ModelScript(chunks=["Alpha answered!"])
    fake_provider.model_scripts["model-beta"] = ModelScript(chunks=["Beta answered!"])

    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Hello alpha"},
        headers=headers,
    )
    assert res.status_code == 200
    events = parse_sse(res.text)

    # SSE contains no model IDs
    status_events = [e[1] for e in events if e[0] == "status"]
    assert len(status_events) > 0
    for s in status_events:
        assert "model_id" not in s
        assert "model-alpha" not in s.get("text", "")

    # Only default model was called
    called_models = [c["model_id"] for c in fake_provider.recorded_calls]
    assert called_models == ["model-alpha"]

    # DB records model-alpha as model_used
    conv = chat_store.get_conversation(conn, conv_id)
    assert conv is not None
    asst_msg = conv["messages"][-1]
    assert asst_msg["model_used"] == "model-alpha"
    assert asst_msg["status"] == "done"
    assert asst_msg["content"] == "Alpha answered!"


def test_default_fails_with_quota_immediate_failover(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id = setup_multi_model_chat(conn)

    fake_provider.model_scripts["model-alpha"] = ModelScript(
        error=ProviderException("Quota limit exceeded", code="quota", retryable=True, status_code=429)
    )
    fake_provider.model_scripts["model-beta"] = ModelScript(
        chunks=["Beta took over immediately!"]
    )

    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Switch to beta"},
        headers=headers,
    )
    assert res.status_code == 200
    events = parse_sse(res.text)

    # Both models called: alpha then beta
    called_models = [c["model_id"] for c in fake_provider.recorded_calls]
    assert called_models == ["model-alpha", "model-beta"]

    # DB assistant message used beta and attempts recorded
    conv = chat_store.get_conversation(conn, conv_id)
    assert conv is not None
    asst_msg = conv["messages"][-1]
    assert asst_msg["model_used"] == "model-beta"
    assert asst_msg["status"] == "done"
    assert asst_msg["content"] == "Beta took over immediately!"
    assert len(asst_msg["attempts"]) == 2
    assert asst_msg["attempts"][0]["model_id"] == "model-alpha"
    assert asst_msg["attempts"][0]["outcome"] == "failed"
    assert asst_msg["attempts"][0]["code"] == "quota"
    assert asst_msg["attempts"][1]["model_id"] == "model-beta"
    assert asst_msg["attempts"][1]["outcome"] == "won"

    # Default model entered cooldown
    health_store = get_health_store()
    alpha_health = health_store.get("model-alpha")
    assert alpha_health.is_in_cooldown() is True

    # failover_events table recorded the transition
    fe_rows = get_failover_events(conn, conv_id)
    assert len(fe_rows) == 1
    assert fe_rows[0]["from_model"] == "model-alpha"
    assert fe_rows[0]["to_model"] == "model-beta"
    assert fe_rows[0]["code"] == "quota"


def test_non_retryable_errors_do_not_failover(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id = setup_multi_model_chat(conn)

    # Safety blocked on alpha -> MUST NOT switch to beta!
    fake_provider.model_scripts["model-alpha"] = ModelScript(
        error=ProviderException("Response blocked by safety filters", code="safety_blocked", retryable=False)
    )
    fake_provider.model_scripts["model-beta"] = ModelScript(chunks=["Should never be called"])

    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Trigger safety block"},
        headers=headers,
    )
    events = parse_sse(res.text)
    error_events = [e[1] for e in events if e[0] == "error"]
    assert len(error_events) == 1
    assert error_events[0]["code"] == "safety_blocked"

    # beta was never called
    called_models = [c["model_id"] for c in fake_provider.recorded_calls]
    assert called_models == ["model-alpha"]

    # No failover event written
    fe_rows = get_failover_events(conn, conv_id)
    assert len(fe_rows) == 0


def test_no_default_configured_uses_ranked_pool(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id = setup_multi_model_chat(conn)


    # Alpha is slower, Beta has better TTFT
    health_store = get_health_store()
    health_store.record_success("model-alpha", 400.0, conn=conn)
    health_store.record_success("model-beta", 100.0, conn=conn)

    fake_provider.model_scripts["model-beta"] = ModelScript(chunks=["Beta answered fastest!"])

    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Pick fastest model"},
        headers=headers,
    )
    assert res.status_code == 200
    called = [c["model_id"] for c in fake_provider.recorded_calls]
    assert called[0] == "model-beta"
