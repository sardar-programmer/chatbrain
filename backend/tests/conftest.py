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
        self.models_to_return: list[ModelInfo] = [
            ModelInfo(
                id="gemini-2.5-flash",
                display_name="Gemini 2.5 Flash",
                provider="gemini",
                capabilities=["text"],
                input_token_limit=1048576,
                output_token_limit=8192,
                supported_actions=["generateContent"],
                status="available",
                last_checked="2026-10-18T00:00:00Z",
            ),
            ModelInfo(
                id="text-embedding-004",
                display_name="Text Embedding 004",
                provider="gemini",
                capabilities=["embeddings"],
                input_token_limit=2048,
                output_token_limit=None,
                supported_actions=["embedContent"],
                status="available",
                last_checked="2026-10-18T00:00:00Z",
            ),
            ModelInfo(
                id="future-custom-model",
                display_name="Future Custom Model",
                provider="gemini",
                capabilities=["unknown"],
                input_token_limit=None,
                output_token_limit=None,
                supported_actions=[],
                status="available",
                last_checked="2026-10-18T00:00:00Z",
            ),
        ]

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
