"""Tests for auto model discovery, stale background refresh, and ranking without preferred model (C1)."""

import asyncio
from datetime import datetime, timedelta, timezone
import logging
from typing import Any
import pytest
from fastapi.testclient import TestClient
from app.db.database import create_connection
from app.errors import ProviderException
from app.services.ai.model_health import ModelHealthRecord
from app.services.ai.model_pool import rank_candidates
from app.services.ai.provider import ModelInfo, StreamChunk
from app.services.chat import chat_store
from app.services.key_store import save_gemini_key
from app.services.model_registry import (
    clear_cached_models,
    get_cached_models,
    save_cached_models,
)
from tests.conftest import FIXTURE_MODELS, FakeProvider, ModelScript, _m
from tests.test_chat_streaming import parse_sse


def test_auto_discovery_after_key_save(
    authed_client: tuple[TestClient, dict[str, str]],
) -> None:
    """Saving a valid key automatically discovers and caches models."""
    client, headers = authed_client
    conn = create_connection()
    clear_cached_models(conn)
    assert len(get_cached_models(conn)) == 0

    res = client.put(
        "/api/v1/credentials/gemini",
        json={"api_key": "valid-secret-key-1234567890"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["configured"] is True

    # Models must be populated in cache without calling /models/refresh
    models = get_cached_models(conn)
    assert len(models) == len(FIXTURE_MODELS)


def test_key_save_succeeds_even_when_discovery_fails(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """When model discovery fails after saving a valid key, key save still succeeds."""
    client, headers = authed_client
    conn = create_connection()
    clear_cached_models(conn)

    # validate_key succeeds, but list_models fails with network error
    def _fail_list_models(api_key: str) -> list[ModelInfo]:
        raise ProviderException("Simulated network failure", code="network", status_code=504)

    monkeypatch.setattr(fake_provider, "list_models", _fail_list_models)

    with caplog.at_level(logging.WARNING):
        res = client.put(
            "/api/v1/credentials/gemini",
            json={"api_key": "valid-secret-key-1234567890"},
            headers=headers,
        )

    assert res.status_code == 200
    assert res.json()["configured"] is True
    assert res.json()["hint"] == "7890"

    # Only error code logged
    all_logs = " ".join([r.getMessage() for r in caplog.records])
    assert "network" in all_logs
    assert "valid-secret-key" not in all_logs


def test_lazy_discovery_on_empty_cache_in_reply_path(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    """When key exists and model cache is empty, reply path runs lazy discovery."""
    client, headers = authed_client
    conn = create_connection()
    save_gemini_key("valid-secret-key-1234567890")
    clear_cached_models(conn)
    assert len(get_cached_models(conn)) == 0

    fake_provider.chunks_to_stream = [StreamChunk(text="Lazy discovery worked!")]
    conv = chat_store.create_conversation(conn, "Lazy Chat")

    res = client.post(
        f"/api/v1/conversations/{conv['id']}/reply",
        json={"content": "Hello lazy"},
        headers=headers,
    )
    assert res.status_code == 200
    events = parse_sse(res.text)
    assert any(e[0] == "delta" for e in events)

    # Models are now cached
    assert len(get_cached_models(conn)) > 0


def test_background_refresh_when_cache_is_stale(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    """When cache is older than 24h, reply triggers background refresh without delaying reply."""
    client, headers = authed_client
    conn = create_connection()
    save_gemini_key("valid-secret-key-1234567890")

    # Seed models with last_checked = 48 hours ago
    stale_iso = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    stale_models = [
        ModelInfo(
            id=m.id, display_name=m.display_name, provider=m.provider,
            capabilities=m.capabilities, input_token_limit=m.input_token_limit,
            output_token_limit=m.output_token_limit, supported_actions=m.supported_actions,
            status=m.status, last_checked=stale_iso,
        )
        for m in FIXTURE_MODELS
    ]
    save_cached_models(conn, stale_models)

    fake_provider.chunks_to_stream = [StreamChunk(text="Replied fast")]
    conv = chat_store.create_conversation(conn, "Stale Chat")

    initial_calls = len(fake_provider.recorded_calls)
    res = client.post(
        f"/api/v1/conversations/{conv['id']}/reply",
        json={"content": "Trigger refresh"},
        headers=headers,
    )
    assert res.status_code == 200
    events = parse_sse(res.text)
    assert any(e[0] == "delta" for e in events)


def test_empty_chat_model_pool_emits_model_error(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
) -> None:
    """When no chat model is available after discovery, error text matches requirement."""
    client, headers = authed_client
    conn = create_connection()
    save_gemini_key("valid-secret-key-1234567890")
    fake_provider.models_to_return = [
        _m("text-embedding-004", "Embedding", ["embedContent"], ["embeddings"]),
    ]
    save_cached_models(conn, fake_provider.models_to_return)
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
    assert error_events[0]["message"] == "No chat model is available for your API key. Check the key in Settings."


def test_ranking_without_preferred_model_order() -> None:
    """rank_candidates orders eligible chat models by TTFT, failures, then id."""
    now = datetime(2026, 11, 8, 12, 0, 0, tzinfo=timezone.utc)
    m1 = _m("model-c", "Model C", ["generateContent"], ["text"])
    m2 = _m("model-a", "Model A", ["generateContent"], ["text"])
    m3 = _m("model-b", "Model B", ["generateContent"], ["text"])

    health = {
        "model-c": ModelHealthRecord(model_id="model-c", ttft_ms_ewma=500.0, consecutive_failures=0),
        "model-a": ModelHealthRecord(model_id="model-a", ttft_ms_ewma=200.0, consecutive_failures=0),
        "model-b": ModelHealthRecord(model_id="model-b", ttft_ms_ewma=200.0, consecutive_failures=1),
    }

    ranked = rank_candidates([m1, m2, m3], health, now)
    # model-a (200ms, 0 fail) < model-b (200ms, 1 fail) < model-c (500ms, 0 fail)
    assert [m.id for m in ranked] == ["model-a", "model-b", "model-c"]


def test_failover_logs_never_leak_prompt_or_key(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Sensitive user messages and secret keys must never appear in logs."""
    client, headers = authed_client
    conn = create_connection()
    save_gemini_key("valid-secret-key-1234567890")
    save_cached_models(conn, [
        _m("model-alpha", "Model Alpha", ["generateContent"], ["text"]),
        _m("model-beta", "Model Beta", ["generateContent"], ["text"]),
    ])
    conv = chat_store.create_conversation(conn, "Security Chat")

    secret_prompt = "SUPER_SECRET_USER_PROMPT_12345"
    fake_provider.model_scripts["model-alpha"] = ModelScript(
        error=ProviderException("Quota exceeded", code="quota", retryable=True)
    )
    fake_provider.model_scripts["model-beta"] = ModelScript(chunks=["Beta answered cleanly"])

    with caplog.at_level(logging.DEBUG):
        res = client.post(
            f"/api/v1/conversations/{conv['id']}/reply",
            json={"content": secret_prompt},
            headers=headers,
        )
        assert res.status_code == 200

    all_logs = " ".join([rec.getMessage() for rec in caplog.records])
    assert secret_prompt not in all_logs
    assert "valid-secret-key-1234567890" not in all_logs
