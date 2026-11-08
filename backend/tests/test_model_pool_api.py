"""Integration tests for model auto-pool controls, health reset, and failovers (M1.3d)."""

from datetime import datetime, timezone
from typing import Any
import pytest
from fastapi.testclient import TestClient
from app.db.database import create_connection
from app.services.ai.model_health import get_health_store
from app.services.chat.failover_events import record_failover_event
from app.services.default_model import set_default_chat_model
from app.services.key_store import save_gemini_key
from app.services.model_registry import save_cached_models
from tests.conftest import FIXTURE_MODELS, _m


def _setup_multi_chat(conn: Any) -> list[str]:
    save_gemini_key("valid-secret-key-1234567890")
    models = [
        _m("model-alpha", "Model Alpha", ["generateContent"], ["text"]),
        _m("model-beta", "Model Beta", ["generateContent"], ["text"]),
        _m("text-embedding-004", "Embedding", ["embedContent"], ["embeddings"]),
    ]
    save_cached_models(conn, models)
    return ["model-alpha", "model-beta"]


def test_pool_endpoints_require_token(client: TestClient) -> None:
    """All auto-pool and health endpoints require authentication."""
    assert client.get("/api/v1/models/pool").status_code == 401
    assert client.patch("/api/v1/models/pool/gemini-2.5-flash", json={"excluded": True}).status_code == 401
    assert client.post("/api/v1/models/health/reset").status_code == 401
    assert client.get("/api/v1/models/failovers").status_code == 401


def test_pool_counts_and_summary(
    authed_client: tuple[TestClient, dict[str, str]],
) -> None:
    """GET /models/pool and GET /status report accurate pool counts."""
    client, headers = authed_client
    conn = create_connection()
    _setup_multi_chat(conn)

    res = client.get("/api/v1/models/pool", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["chat_model_count"] == 2
    assert data["ready_count"] == 2
    assert data["cooling_count"] == 0
    assert data["excluded_count"] == 0
    assert data["excluded"] == []

    # Put one model in cooldown
    health_store = get_health_store()
    health_store.record_failure("model-alpha", "unavailable", conn=conn)

    res2 = client.get("/api/v1/models/pool", headers=headers)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["ready_count"] == 1
    assert data2["cooling_count"] == 1

    # Verify status endpoint includes pool_summary and failover_count_24h
    res_status = client.get("/api/v1/status", headers=headers)
    assert res_status.status_code == 200
    s_data = res_status.json()
    assert s_data["pool_summary"] == {
        "chat_model_count": 2,
        "ready_count": 1,
        "cooling_count": 1,
        "excluded_count": 0,
    }
    assert s_data["failover_count_24h"] == 0


def test_exclude_then_include_round_trip(
    authed_client: tuple[TestClient, dict[str, str]],
) -> None:
    """PATCH /models/pool/{id} toggles exclusion status and updates counts."""
    client, headers = authed_client
    conn = create_connection()
    _setup_multi_chat(conn)

    # Exclude model-alpha
    res = client.patch(
        "/api/v1/models/pool/model-alpha",
        json={"excluded": True},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["excluded"] == ["model-alpha"]
    assert data["excluded_count"] == 1
    assert data["ready_count"] == 1

    # Verify persisted in GET /models/pool
    res_get = client.get("/api/v1/models/pool", headers=headers)
    assert res_get.json()["excluded"] == ["model-alpha"]

    # Re-include model-alpha
    res_inc = client.patch(
        "/api/v1/models/pool/model-alpha",
        json={"excluded": False},
        headers=headers,
    )
    assert res_inc.status_code == 200
    assert res_inc.json()["excluded"] == []
    assert res_inc.json()["excluded_count"] == 0
    assert res_inc.json()["ready_count"] == 2


def test_cannot_exclude_last_remaining_chat_model(
    authed_client: tuple[TestClient, dict[str, str]],
) -> None:
    """Pool cannot be left with zero chat models."""
    client, headers = authed_client
    conn = create_connection()
    _setup_multi_chat(conn)

    # Exclude alpha
    client.patch("/api/v1/models/pool/model-alpha", json={"excluded": True}, headers=headers)

    # Attempt to exclude beta (the last remaining chat model)
    res = client.patch("/api/v1/models/pool/model-beta", json={"excluded": True}, headers=headers)
    assert res.status_code == 422
    assert "Cannot exclude the last remaining chat model" in res.json()["error"]["message"]


def test_cannot_exclude_preferred_model(
    authed_client: tuple[TestClient, dict[str, str]],
) -> None:
    """Cannot exclude a model that is currently saved as preferred."""
    client, headers = authed_client
    conn = create_connection()
    _setup_multi_chat(conn)
    set_default_chat_model(conn, "model-alpha")

    # Attempt to exclude preferred model
    res = client.patch("/api/v1/models/pool/model-alpha", json={"excluded": True}, headers=headers)
    assert res.status_code == 422
    assert "Clear the preferred model first" in res.json()["error"]["message"]

    # Non-preferred model can be excluded
    res_beta = client.patch("/api/v1/models/pool/model-beta", json={"excluded": True}, headers=headers)
    assert res_beta.status_code == 200
    assert "model-beta" in res_beta.json()["excluded"]


def test_cannot_exclude_non_chat_or_unknown_model(
    authed_client: tuple[TestClient, dict[str, str]],
) -> None:
    """Reject unknown or non-chat models."""
    client, headers = authed_client
    conn = create_connection()
    _setup_multi_chat(conn)

    # Unknown model -> 404
    res_404 = client.patch("/api/v1/models/pool/unknown-model-xyz", json={"excluded": True}, headers=headers)
    assert res_404.status_code == 404

    # Non-chat model -> 422
    res_422 = client.patch("/api/v1/models/pool/text-embedding-004", json={"excluded": True}, headers=headers)
    assert res_422.status_code == 422
    assert "is not a chat model" in res_422.json()["error"]["message"]


def test_reset_clears_cooldowns_keeps_excluded_and_preferred(
    authed_client: tuple[TestClient, dict[str, str]],
) -> None:
    """POST /models/health/reset wipes health metrics/cooldowns but keeps settings."""
    client, headers = authed_client
    conn = create_connection()
    _setup_multi_chat(conn)
    set_default_chat_model(conn, "model-alpha")
    client.patch("/api/v1/models/pool/model-beta", json={"excluded": True}, headers=headers)

    health_store = get_health_store()
    health_store.record_failure("model-alpha", "quota", conn=conn)
    assert health_store.get("model-alpha").is_in_cooldown() is True

    res = client.post("/api/v1/models/health/reset", headers=headers)
    assert res.status_code == 200
    assert res.json() == {"reset": True}

    # Cooldown cleared
    assert health_store.get("model-alpha").is_in_cooldown() is False
    assert health_store.get("model-alpha").failures == 0

    # Preferred model preserved
    res_def = client.get("/api/v1/models/default", headers=headers)
    assert res_def.json()["model_id"] == "model-alpha"
    assert res_def.json()["valid"] is True

    # Excluded list preserved
    res_pool = client.get("/api/v1/models/pool", headers=headers)
    assert res_pool.json()["excluded"] == ["model-beta"]


def test_failovers_ordering_and_limit_cap(
    authed_client: tuple[TestClient, dict[str, str]],
) -> None:
    """GET /models/failovers returns newest first and respects limits."""
    client, headers = authed_client
    conn = create_connection()

    for i in range(1, 6):
        record_failover_event(
            conn=conn,
            conversation_id="conv-123",
            message_id="msg-123",
            from_model="model-alpha",
            to_model="model-beta",
            code="unavailable",
            round_num=i,
            at=f"2026-11-08T12:00:0{i}Z",
        )

    res = client.get("/api/v1/models/failovers?limit=3", headers=headers)
    assert res.status_code == 200
    events = res.json()
    assert len(events) == 3
    # Newest first
    assert events[0]["round"] == 5
    assert events[1]["round"] == 4
    assert events[2]["round"] == 3

    # Shape check: no conversation_id or message_id
    assert set(events[0].keys()) == {"at", "from_model", "to_model", "code", "round"}

    # Limit capped at 100
    res_over = client.get("/api/v1/models/failovers?limit=101", headers=headers)
    assert res_over.status_code == 422

    # Status includes failover_count_24h
    res_status = client.get("/api/v1/status", headers=headers)
    assert res_status.json()["failover_count_24h"] == 5
