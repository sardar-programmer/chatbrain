"""Tests for M1.2b: model kind and default chat model."""

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

