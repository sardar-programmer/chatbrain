"""API tests for /models/health and /models/health/scan (M1.3c)."""

import logging
from typing import Any
import pytest
from fastapi.testclient import TestClient
from app.db.database import create_connection
from app.errors import ProviderException
from app.services.ai.model_health import get_health_store
from app.services.default_model import set_default_chat_model
from app.services.key_store import save_gemini_key
from app.services.model_registry import save_cached_models
from app.services.settings_store import set_auto_pool_excluded
from tests.conftest import FIXTURE_MODELS, FakeProvider, ModelScript, _m


def test_get_models_health_requires_token(client: TestClient) -> None:
    res = client.get("/api/v1/models/health")
    assert res.status_code == 401


def test_get_models_health_shape_and_ranking(
    authed_client: tuple[TestClient, dict[str, str]],
) -> None:
    client, headers = authed_client
    conn = create_connection()
    save_gemini_key("valid-secret-key-1234567890")
    save_cached_models(conn, FIXTURE_MODELS)
    set_default_chat_model(conn, "gemini-2.5-flash")
    set_auto_pool_excluded(conn, ["gemini-2.5-pro"])

    health_store = get_health_store()
    health_store.record_success("gemini-2.5-flash", 250.0, conn=conn)
    health_store.record_failure("gemini-2.5-pro", "unavailable", conn=conn)

    res = client.get("/api/v1/models/health", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "models" in data
    assert "ranked" in data

    models_map = {m["model_id"]: m for m in data["models"]}
    assert "gemini-2.5-flash" in models_map
    flash_item = models_map["gemini-2.5-flash"]
    assert flash_item["kind"] == "chat"
    assert flash_item["successes"] == 1
    assert flash_item["ttft_ms_ewma"] == 250.0
    assert flash_item["excluded"] is False

    pro_item = models_map["gemini-2.5-pro"]
    assert pro_item["failures"] == 1
    assert pro_item["in_cooldown"] is True
    assert pro_item["last_error_code"] == "unavailable"
    assert pro_item["excluded"] is True
    assert "gemini-2.5-pro" not in data["ranked"]

    # Ranked try order: default first
    assert data["ranked"][0] == "gemini-2.5-flash"


def test_scan_models_health_summary_and_early_stop(
    authed_client: tuple[TestClient, dict[str, str]],
    fake_provider: FakeProvider,
    caplog: pytest.LogCaptureFixture,
) -> None:
    client, headers = authed_client
    conn = create_connection()
    save_gemini_key("valid-secret-key-1234567890")

    # Add 4 chat models to registry
    models = [
        _m("chat-model-1", "Chat Model 1", ["generateContent"], ["text"]),
        _m("chat-model-2", "Chat Model 2", ["generateContent"], ["text"]),
        _m("chat-model-3", "Chat Model 3", ["generateContent"], ["text"]),
        _m("chat-model-4", "Chat Model 4", ["generateContent"], ["text"]),
    ]
    save_cached_models(conn, models)

    # Configure the first 3 models to fail with quota in a row
    for mid in ["chat-model-1", "chat-model-2", "chat-model-3"]:
        fake_provider.model_scripts[mid] = ModelScript(
            error=ProviderException("Quota exceeded", code="quota", retryable=True, status_code=429)
        )
    fake_provider.model_scripts["chat-model-4"] = ModelScript(
        chunks=["Ping response"]
    )

    with caplog.at_level(logging.INFO):
        res = client.post(
            "/api/v1/models/health/scan",
            json={"limit": 10},
            headers=headers,
        )
    assert res.status_code == 200
    data = res.json()

    assert data["checked"] == 3
    assert data["available"] == 0
    assert data["failed"] == 3
    assert len(data["results"]) == 3
    for r in data["results"]:
        assert r["ok"] is False
        assert r["code"] == "quota"

    # Logging verification: log only model IDs and codes, never user data or secrets
    assert "valid-secret-key" not in caplog.text
    assert "Chat Model" not in caplog.text
