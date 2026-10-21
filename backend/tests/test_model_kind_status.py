"""Tests for M1.2b: model kind, default chat model, status endpoint."""

from fastapi.testclient import TestClient
import pytest
from tests.conftest import FIXTURE_MODELS, FakeProvider
from app.services.ai.provider import ModelInfo, derive_kind


# ---------------------------------------------------------------------------
# Unit tests for derive_kind (pure function)
# ---------------------------------------------------------------------------

def _kind(model: ModelInfo) -> tuple[str, bool]:
    k = derive_kind(model.id, model.supported_actions, list(model.capabilities))
    return k.kind, k.kind_inferred


def _find(model_id: str) -> ModelInfo:
    m = next(m for m in FIXTURE_MODELS if m.id == model_id)
    return m


def test_kind_chat() -> None:
    m = _find("gemini-2.5-flash")
    assert _kind(m) == ("chat", False)


def test_kind_live() -> None:
    m = _find("gemini-live-002")
    assert _kind(m) == ("live", False)


def test_kind_embeddings() -> None:
    m = _find("text-embedding-004")
    assert _kind(m) == ("embeddings", False)


def test_kind_image() -> None:
    m = _find("imagen-3.0-generate")
    assert _kind(m) == ("image", False)


def test_kind_audio_tts() -> None:
    m = _find("gemini-tts-001")
    assert _kind(m) == ("audio", False)


def test_kind_video_predicted_long_running() -> None:
    m = _find("veo-2.0-generate")
    assert _kind(m) == ("video", True)  # inferred because action isn't video-specific


def test_kind_music_action() -> None:
    m = _find("music-fx-002")
    assert _kind(m) == ("music", False)


def test_kind_transcribe_id_fragment() -> None:
    m = _find("gemini-transcribe-001")
    assert _kind(m) == ("transcribe", True)


def test_kind_agent_id_fragment() -> None:
    m = _find("antigravity-001")
    assert _kind(m) == ("agent", True)


def test_kind_research_id_fragment() -> None:
    m = _find("gemini-deep-research-001")
    assert _kind(m) == ("research", True)


def test_kind_qa_generate_answer() -> None:
    m = _find("aqa-model-001")
    assert _kind(m) == ("qa", False)


def test_kind_unknown_no_actions() -> None:
    m = _find("future-custom-model")
    assert _kind(m) == ("unknown", False)


def test_kind_music_lyria_id() -> None:
    m = ModelInfo(
        id="lyria-rtmidi-test", display_name="Lyria RT",
        provider="gemini", capabilities=[], supported_actions=[],
        status="available", last_checked="2026-10-21T00:00:00Z",
    )
    assert _kind(m) == ("music", True)


def test_kind_robotics_id() -> None:
    m = ModelInfo(
        id="gemini-robotics-er", display_name="Gemini Robotics ER",
        provider="gemini", capabilities=[], supported_actions=["generateContent"],
        status="available", last_checked="2026-10-21T00:00:00Z",
    )
    assert _kind(m) == ("robotics", True)


def test_kind_computer_use_id() -> None:
    m = ModelInfo(
        id="computer-use-preview", display_name="Computer Use",
        provider="gemini", capabilities=[], supported_actions=["generateContent"],
        status="available", last_checked="2026-10-21T00:00:00Z",
    )
    assert _kind(m) == ("agent", True)


# ---------------------------------------------------------------------------
# GET /models includes kind + kind_inferred
# ---------------------------------------------------------------------------

def test_get_models_includes_kind(client: TestClient, auth_headers: dict[str, str]) -> None:
    """GET /models must return kind and kind_inferred on each model."""
    client.put("/api/v1/credentials/gemini", json={"api_key": "valid-secret-key-1234567890"}, headers=auth_headers)
    client.post("/api/v1/models/refresh", headers=auth_headers)
    res = client.get("/api/v1/models", headers=auth_headers)
    assert res.status_code == 200
    models = res.json()["models"]
    assert len(models) > 0
    for m in models:
        assert "kind" in m
        assert "kind_inferred" in m
        assert isinstance(m["kind"], str)
        assert isinstance(m["kind_inferred"], bool)


# ---------------------------------------------------------------------------
# Default chat model — GET / PUT / DELETE
# ---------------------------------------------------------------------------

def _setup_key_and_refresh(client: TestClient, auth_headers: dict[str, str]) -> None:
    client.put("/api/v1/credentials/gemini", json={"api_key": "valid-secret-key-1234567890"}, headers=auth_headers)
    client.post("/api/v1/models/refresh", headers=auth_headers)


def test_put_default_chat_model_accepts_chat_kind(client: TestClient, auth_headers: dict[str, str]) -> None:
    """PUT /models/default accepts a model whose kind is 'chat'."""
    _setup_key_and_refresh(client, auth_headers)
    res = client.put("/api/v1/models/default", json={"model_id": "gemini-2.5-flash"}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["model_id"] == "gemini-2.5-flash"
    assert res.json()["valid"] is True
    assert res.json()["reason"] is None


def test_put_default_rejects_non_chat_without_force(client: TestClient, auth_headers: dict[str, str]) -> None:
    """PUT /models/default rejects a non-chat model without force=true."""
    _setup_key_and_refresh(client, auth_headers)
    res = client.put("/api/v1/models/default", json={"model_id": "text-embedding-004"}, headers=auth_headers)
    assert res.status_code == 400
    assert res.json()["error"]["category"] == "validation"


def test_put_default_accepts_non_chat_with_force(client: TestClient, auth_headers: dict[str, str]) -> None:
    """PUT /models/default accepts a non-chat model when force=true."""
    _setup_key_and_refresh(client, auth_headers)
    res = client.put(
        "/api/v1/models/default",
        json={"model_id": "text-embedding-004", "force": True},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["valid"] is True


def test_put_default_rejects_model_not_in_cache(client: TestClient, auth_headers: dict[str, str]) -> None:
    """PUT /models/default with a model not in the cache returns 404-style not_found."""
    _setup_key_and_refresh(client, auth_headers)
    res = client.put("/api/v1/models/default", json={"model_id": "nonexistent-model-xyz"}, headers=auth_headers)
    assert res.status_code == 404
    assert res.json()["error"]["category"] == "not_found"


def test_get_default_model(client: TestClient, auth_headers: dict[str, str]) -> None:
    """GET /models/default returns correct status after PUT."""
    _setup_key_and_refresh(client, auth_headers)
    client.put("/api/v1/models/default", json={"model_id": "gemini-2.5-flash"}, headers=auth_headers)
    res = client.get("/api/v1/models/default", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["model_id"] == "gemini-2.5-flash"
    assert data["valid"] is True


def test_delete_default_model(client: TestClient, auth_headers: dict[str, str]) -> None:
    """DELETE /models/default clears the selection."""
    _setup_key_and_refresh(client, auth_headers)
    client.put("/api/v1/models/default", json={"model_id": "gemini-2.5-flash"}, headers=auth_headers)
    res = client.delete("/api/v1/models/default", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["model_id"] is None
    assert res.json()["valid"] is False
    assert res.json()["reason"] is None


def test_default_model_invalid_after_refresh_without_model(
    client: TestClient,
    auth_headers: dict[str, str],
    fake_provider: FakeProvider,
) -> None:
    """After a refresh that drops the saved model, GET reports valid:false reason=model_not_found.
    The saved value must NOT be changed."""
    _setup_key_and_refresh(client, auth_headers)
    client.put("/api/v1/models/default", json={"model_id": "gemini-2.5-flash"}, headers=auth_headers)

    # Remove the model from the provider's list
    fake_provider.models_to_return = [
        m for m in FIXTURE_MODELS if m.id != "gemini-2.5-flash"
    ]
    client.post("/api/v1/models/refresh", headers=auth_headers)

    res = client.get("/api/v1/models/default", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["model_id"] == "gemini-2.5-flash"  # value preserved
    assert data["valid"] is False
    assert data["reason"] == "model_not_found"


# ---------------------------------------------------------------------------
# Status endpoint
# ---------------------------------------------------------------------------

def test_status_requires_token(client: TestClient) -> None:
    """GET /api/v1/status returns 401 without a token."""
    res = client.get("/api/v1/status")
    assert res.status_code == 401


def test_status_never_contains_key(client: TestClient, auth_headers: dict[str, str]) -> None:
    """Status response must never contain the raw API key."""
    _setup_key_and_refresh(client, auth_headers)
    res = client.get("/api/v1/status", headers=auth_headers)
    assert res.status_code == 200
    assert "valid-secret-key-1234567890" not in res.text
    data = res.json()
    assert data["key_configured"] is True


def test_status_shape(client: TestClient, auth_headers: dict[str, str]) -> None:
    """GET /api/v1/status has the expected top-level fields."""
    res = client.get("/api/v1/status", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["api"] == "ok"
    assert isinstance(data["db"], bool)
    assert isinstance(data["python_version"], str)
    assert isinstance(data["key_configured"], bool)
    assert isinstance(data["models_count"], int)


def test_status_last_provider_error_stores_only_category_and_timestamp(
    client: TestClient,
    auth_headers: dict[str, str],
    fake_provider: FakeProvider,
) -> None:
    """last_provider_error must store only category + at, never message text or key."""
    fake_provider.should_fail_quota = True
    # Trigger a provider error
    client.put("/api/v1/credentials/gemini", json={"api_key": "valid-secret-key-1234567890"}, headers=auth_headers)

    res = client.get("/api/v1/status", headers=auth_headers)
    data = res.json()

    # If a provider error was recorded it must only have category and at
    if data["last_provider_error"] is not None:
        err = data["last_provider_error"]
        assert set(err.keys()) == {"category", "at"}
        assert "valid-secret-key-1234567890" not in str(err)
        # No message field
        assert "message" not in err

    # Key must never appear anywhere
    assert "valid-secret-key-1234567890" not in res.text


def test_status_last_provider_success_at_recorded(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    """last_provider_success_at is recorded after a successful test/refresh."""
    _setup_key_and_refresh(client, auth_headers)
    client.post("/api/v1/credentials/gemini/test", headers=auth_headers)
    res = client.get("/api/v1/status", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["last_provider_success_at"] is not None
