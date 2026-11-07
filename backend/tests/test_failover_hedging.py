"""Integration tests for model hedging, disconnects during hedge, and budget retry (M1.3c)."""

import asyncio
import logging
from typing import Any
import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request
from app.db.database import create_connection
from app.errors import ProviderException
from app.services.ai.model_health import get_health_store
from app.services.ai.provider import StreamChunk
from app.services.chat import chat_store
from app.services.chat.failover_config import FailoverConfig, set_failover_config
from app.services.chat.failover_events import get_failover_events
from app.services.default_model import set_default_chat_model
from app.services.key_store import save_gemini_key
from app.services.model_registry import save_cached_models
from tests.conftest import FIXTURE_MODELS, FakeProvider, ModelScript, _m
from tests.test_chat_streaming import parse_sse


def setup_multi_model(conn: Any) -> str:
    save_gemini_key("valid-secret-key-1234567890")
    models = [
        _m("model-alpha", "Model Alpha", ["generateContent"], ["text"]),
        _m("model-beta", "Model Beta", ["generateContent"], ["text"]),
    ]
    save_cached_models(conn, models)
    set_default_chat_model(conn, "model-alpha")
    conv = chat_store.create_conversation(conn, "Hedge Chat")
    return conv["id"]


def test_hedging_starts_parallel_and_fastest_wins(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id = setup_multi_model(conn)

    set_failover_config(FailoverConfig(
        hedge_delay=0.03,
        first_token_timeout=0.4,
        total_budget=2.0,
    ))

    # Alpha is slow (0.12s first chunk), Beta is fast (0.01s first chunk)
    fake_provider.model_scripts["model-alpha"] = ModelScript(chunks=["Alpha slow"], delay=0.12)
    fake_provider.model_scripts["model-beta"] = ModelScript(chunks=["Beta fast"], delay=0.01)

    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Hedge test"},
        headers=headers,
    )
    assert res.status_code == 200
    events = parse_sse(res.text)

    # Beta won and answered
    text_events = [e[1] for e in events if e[0] == "delta"]
    assert len(text_events) == 1
    assert text_events[0]["text"] == "Beta fast"

    # Both models were called
    called = [c["model_id"] for c in fake_provider.recorded_calls]
    assert "model-alpha" in called and "model-beta" in called

    # DB records beta as winner and alpha as cancelled (not failed)
    conv = chat_store.get_conversation(conn, conv_id)
    assert conv is not None
    asst_msg = conv["messages"][-1]
    assert asst_msg["model_used"] == "model-beta"
    assert asst_msg["status"] == "done"

    attempts = asst_msg["attempts"]
    alpha_att = next(a for a in attempts if a["model_id"] == "model-alpha")
    beta_att = next(a for a in attempts if a["model_id"] == "model-beta")
    assert alpha_att["outcome"] == "cancelled"
    assert beta_att["outcome"] == "won"

    # Alpha health has 0 failures (cancelled in hedge carries no penalty)
    health = get_health_store().get("model-alpha")
    assert health.failures == 0
    assert fake_provider.model_scripts["model-alpha"].stream_closed is True


def test_client_disconnect_during_hedge_cancels_both_and_releases_lock(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id = setup_multi_model(conn)

    set_failover_config(FailoverConfig(
        hedge_delay=0.02,
        first_token_timeout=0.5,
        total_budget=2.0,
    ))

    fake_provider.model_scripts["model-alpha"] = ModelScript(chunks=["Alpha"], delay=0.2)
    fake_provider.model_scripts["model-beta"] = ModelScript(chunks=["Beta"], delay=0.2)

    disconnected_active = True

    async def mock_is_disconnected(self: Any) -> bool:
        return disconnected_active and len(fake_provider.recorded_calls) >= 2

    monkeypatch.setattr(Request, "is_disconnected", mock_is_disconnected)

    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Disconnect mid-hedge"},
        headers=headers,
    )
    assert res.status_code == 200

    # Upstream streams were closed
    assert fake_provider.model_scripts["model-alpha"].stream_closed is True
    assert fake_provider.model_scripts["model-beta"].stream_closed is True

    # DB assistant message is marked stopped
    conv = chat_store.get_conversation(conn, conv_id)
    assert conv is not None
    asst_msg = conv["messages"][-1]
    assert asst_msg["status"] == "stopped"

    # Lock is released: immediate next reply does NOT return 409
    disconnected_active = False
    fake_provider.model_scripts["model-alpha"] = ModelScript(chunks=["Second reply ok"])
    res2 = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Immediate follow up"},
        headers=headers,
    )
    assert res2.status_code == 200


def test_mid_stream_failure_preserves_partial_and_no_switch(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id = setup_multi_model(conn)

    fake_provider.model_scripts["model-alpha"] = ModelScript(
        chunks=["First part of text ", "second chunk"],
        error_after_chunks=1,
        error=ProviderException("Mid-stream connection broken", code="network", retryable=True),
    )
    fake_provider.model_scripts["model-beta"] = ModelScript(chunks=["Should not be used"])

    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "Test mid-stream error"},
        headers=headers,
    )
    assert res.status_code == 200
    events = parse_sse(res.text)

    # Ended in error
    error_events = [e[1] for e in events if e[0] == "error"]
    assert len(error_events) == 1
    assert error_events[0]["code"] == "network"

    # Beta was NEVER called (failover not allowed after first token)
    called = [c["model_id"] for c in fake_provider.recorded_calls]
    assert called == ["model-alpha"]

    # Partial content preserved in DB
    conv = chat_store.get_conversation(conn, conv_id)
    assert conv is not None
    asst_msg = conv["messages"][-1]
    assert asst_msg["status"] == "error"
    assert asst_msg["content"] == "First part of text "
    assert asst_msg["model_used"] == "model-alpha"


def test_all_models_fail_emits_retrying_and_budget_exhaustion(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id = setup_multi_model(conn)

    # Use short budget and backoff steps for fast deterministic test
    set_failover_config(FailoverConfig(
        first_token_timeout=0.03,
        total_budget=0.12,
        backoff_steps=[0.02, 0.02],
    ))

    fake_provider.model_scripts["model-alpha"] = ModelScript(
        error=ProviderException("Unavailable", code="unavailable", retryable=True)
    )
    fake_provider.model_scripts["model-beta"] = ModelScript(
        error=ProviderException("Quota limit", code="quota", retryable=True)
    )

    res = client.post(
        f"/api/v1/conversations/{conv_id}/reply",
        json={"content": "All fail test"},
        headers=headers,
    )
    assert res.status_code == 200
    events = parse_sse(res.text)

    # Emits retrying status events
    status_events = [e[1] for e in events if e[0] == "status" and e[1].get("phase") == "retrying"]
    assert len(status_events) >= 1
    assert "Retrying in" in status_events[0]["text"]

    # Emits final all_models_unavailable error
    error_events = [e[1] for e in events if e[0] == "error"]
    assert len(error_events) == 1
    assert error_events[0]["code"] == "all_models_unavailable"
    assert error_events[0]["retryable"] is True


def test_empty_chat_model_pool_emits_model_error(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    save_gemini_key("valid-secret-key-1234567890")

    # Only non-chat models
    save_cached_models(conn, [
        _m("text-embedding-004", "Embedding", ["embedContent"], ["embeddings"]),
    ])
    conv = chat_store.create_conversation(conn, "No Chat Models")

    res = client.post(
        f"/api/v1/conversations/{conv['id']}/reply",
        json={"content": "Hello empty pool"},
        headers=headers,
    )
    assert res.status_code == 200
    events = parse_sse(res.text)

    error_events = [e[1] for e in events if e[0] == "error"]
    assert len(error_events) == 1
    assert error_events[0]["category"] == "model"
    assert "No chat model is available yet" in error_events[0]["message"]
    assert len(fake_provider.recorded_calls) == 0


def test_failover_logs_never_leak_prompt_or_key(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
    caplog: pytest.LogCaptureFixture,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    conv_id = setup_multi_model(conn)

    secret_prompt = "SUPER_SECRET_USER_PROMPT_12345"
    fake_provider.model_scripts["model-alpha"] = ModelScript(
        error=ProviderException("Quota exceeded", code="quota", retryable=True)
    )
    fake_provider.model_scripts["model-beta"] = ModelScript(chunks=["Beta answered cleanly"])

    with caplog.at_level(logging.DEBUG):
        res = client.post(
            f"/api/v1/conversations/{conv_id}/reply",
            json={"content": secret_prompt},
            headers=headers,
        )
        assert res.status_code == 200

    all_logs = " ".join([rec.getMessage() for rec in caplog.records])
    assert secret_prompt not in all_logs
    assert "valid-secret-key-1234567890" not in all_logs
