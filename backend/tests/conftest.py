"""Pytest configuration and isolated testing fixtures."""

from collections.abc import Generator
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app.config import get_settings
from app.db.migrations import run_migrations
from app.errors import ProviderException
from app.main import app
from app.security import TOKEN_HEADER_NAME
from app.services.ai.provider import ModelInfo, set_ai_provider


def _m(
    model_id: str,
    display_name: str,
    supported_actions: list[str],
    capabilities: list[str] | None = None,
) -> ModelInfo:
    """Helper to build a ModelInfo quickly."""
    return ModelInfo(
        id=model_id,
        display_name=display_name,
        provider="gemini",
        capabilities=capabilities or [],
        input_token_limit=1024,
        output_token_limit=256,
        supported_actions=supported_actions,
        status="available",
        last_checked="2026-10-21T00:00:00Z",
    )


# Canonical fixture list — mirrors all kinds required by M1.2b tests
FIXTURE_MODELS: list[ModelInfo] = [
    # chat: generateContent + countTokens, no special capabilities
    _m("gemini-2.5-flash", "Gemini 2.5 Flash", ["generateContent", "countTokens"], ["text"]),
    # live: bidiGenerateContent only (no generateContent)
    _m("gemini-live-002", "Gemini Live 002", ["bidiGenerateContent"]),
    # embeddings: embedContent
    _m("text-embedding-004", "Text Embedding 004", ["embedContent"], ["embeddings"]),
    # image: generateContent + capability "image"
    _m("imagen-3.0-generate", "Imagen 3.0", ["generateContent"], ["text", "image"]),
    # audio/TTS: generateContent + capability "audio"
    _m("gemini-tts-001", "Gemini TTS 001", ["generateContent"], ["text", "audio"]),
    # video: predictLongRunning
    _m("veo-2.0-generate", "Veo 2.0", ["predictLongRunning"]),
    # music: bidiGenerateMusic
    _m("music-fx-002", "Music FX 002", ["bidiGenerateMusic"]),
    # transcribe: id fragment
    _m("gemini-transcribe-001", "Gemini Transcribe", ["generateContent"]),
    # agent: id fragment "antigravity"
    _m("antigravity-001", "Antigravity Agent", ["generateContent"]),
    # research: id fragment "deep-research"
    _m("gemini-deep-research-001", "Gemini Deep Research", ["generateContent"]),
    # qa: generateAnswer action
    _m("aqa-model-001", "AQA Model", ["generateAnswer"]),
    # unknown: no actions, no capabilities
    _m("future-custom-model", "Future Custom Model", []),
]


class FakeProvider:
    """Deterministic in-memory AI provider that never makes external network calls."""

    def __init__(
        self,
        valid_keys: set[str] | None = None,
        should_fail_quota: bool = False,
        should_fail_network: bool = False,
    ) -> None:
        self.valid_keys = valid_keys or {"valid-secret-key-1234567890"}
        self.should_fail_quota = should_fail_quota
        self.should_fail_network = should_fail_network
        self.models_to_return: list[ModelInfo] = list(FIXTURE_MODELS)

    def validate_key(self, api_key: str) -> bool:
        if self.should_fail_network:
            raise ProviderException("Network error contacting Gemini API", status_code=504)
        if self.should_fail_quota:
            raise ProviderException("Gemini quota exceeded", status_code=429)
        if api_key not in self.valid_keys:
            raise ProviderException("Invalid Gemini API key", status_code=400)
        return True

    def list_models(self, api_key: str) -> list[ModelInfo]:
        self.validate_key(api_key)
        return self.models_to_return


@pytest.fixture
def fake_provider() -> FakeProvider:
    """Fixture providing a fresh FakeProvider."""
    return FakeProvider()


@pytest.fixture(autouse=True)
def setup_test_env(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    fake_provider: FakeProvider,
) -> Generator[None, None, None]:
    """Isolate tests with temporary SQLite DB, secret dir, and FakeProvider."""
    test_db = tmp_path / "test_app.db"
    test_secrets = tmp_path / "secrets"
    test_secrets.mkdir(parents=True, exist_ok=True)

    settings = get_settings()
    monkeypatch.setattr(settings, "db_path", str(test_db))

    import app.services.key_store as key_store

    monkeypatch.setattr(key_store, "get_secrets_dir", lambda: test_secrets)

    run_migrations(test_db)
    set_ai_provider(fake_provider)

    yield

    set_ai_provider(None)


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Test client instance."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_headers(client: TestClient) -> dict[str, str]:
    """Helper fixture providing valid X-ChatBrain-Token header."""
    res = client.get("/api/v1/bootstrap")
    token = res.json()["token"]
    return {TOKEN_HEADER_NAME: token}


@pytest.fixture
def authed_client(client: TestClient, auth_headers: dict[str, str]) -> tuple[TestClient, dict[str, str]]:
    """Convenience fixture returning (client, auth_headers)."""
    return client, auth_headers
