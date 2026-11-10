"""API tests for /models/health (M1.3c)."""

from fastapi.testclient import TestClient
from app.db.database import create_connection
from app.services.ai.model_health import get_health_store
from app.services.key_store import save_gemini_key
from app.services.model_registry import save_cached_models
from tests.conftest import FIXTURE_MODELS


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
    # excluded field removed in C0b
    assert "excluded" not in flash_item

    pro_item = models_map["gemini-2.5-pro"]
    assert pro_item["failures"] == 1
    assert pro_item["in_cooldown"] is True
    assert pro_item["last_error_code"] == "unavailable"

    # Ranked try order: lower TTFT first
    assert data["ranked"][0] == "gemini-2.5-flash"
    # Cooling model still present in models list but excluded from ranked
    assert "gemini-2.5-pro" not in data["ranked"]
