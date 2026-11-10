"""Pytest configuration and isolated testing fixtures."""

import asyncio
from collections.abc import AsyncIterator, Generator
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import pytest
from fastapi.testclient import TestClient
from app.config import get_settings
from app.db.migrations import run_migrations
from app.errors import ProviderException
from app.main import app
from app.security import TOKEN_HEADER_NAME
from app.services.ai.model_health import ModelHealthStore, set_health_store
from app.services.ai.provider import (
    ModelInfo,
    StreamChunk,
    derive_capabilities,
    set_ai_provider,
)
from app.services.chat.failover_config import FailoverConfig, set_failover_config


def _m(
    model_id: str,
    display_name: str,
    supported_actions: list[str],
    capabilities: list[str] | None = None,
    input_token_limit: int | None = 1024,
    output_token_limit: int | None = 256,
    last_checked: str | None = None,
) -> ModelInfo:
    """Helper to build a ModelInfo quickly."""
    if capabilities is None:
        caps = derive_capabilities(supported_actions)
    else:
        caps = capabilities if capabilities else ["unknown"]
    return ModelInfo(
        id=model_id,
        display_name=display_name,
        provider="gemini",
        capabilities=caps,
        input_token_limit=input_token_limit,
        output_token_limit=output_token_limit,
        supported_actions=supported_actions,
        status="available",
        last_checked=last_checked or datetime.now(timezone.utc).isoformat(),
    )


FIXTURE_MODELS: list[ModelInfo] = [
    _m(
        "gemini-2.5-flash",
        "Gemini 2.5 Flash",
        ["generateContent", "countTokens"],
        ["text"],
        input_token_limit=1048576,
        output_token_limit=8192,
    ),
    _m(
        "gemini-2.5-pro",
        "Gemini 2.5 Pro",
        ["generateContent", "countTokens"],
        ["text"],
        input_token_limit=1048576,
        output_token_limit=8192,
    ),
    _m("gemini-live-002", "Gemini Live 002", ["bidiGenerateContent"]),
    _m("text-embedding-004", "Text Embedding 004", ["embedContent"], ["embeddings"]),
    _m("imagen-3.0-generate", "Imagen 3.0", ["generateContent"], ["text", "image"]),
    _m("gemini-tts-001", "Gemini TTS 001", ["generateContent"], ["text", "audio"]),
    _m("veo-2.0-generate", "Veo 2.0", ["predictLongRunning"]),
    _m("music-fx-002", "Music FX 002", ["bidiGenerateMusic"]),
    _m("gemini-transcribe-001", "Gemini Transcribe", ["generateContent"]),
    _m("antigravity-001", "Antigravity Agent", ["generateContent"]),
    _m("gemini-deep-research-001", "Gemini Deep Research", ["generateContent"]),
    _m("aqa-model-001", "AQA Model", ["generateAnswer"]),
    _m("future-custom-model", "Future Custom Model", []),
]


@dataclass
class ModelScript:
    """Scripted behaviour for a specific model."""

    chunks: list[StreamChunk | str] = field(default_factory=lambda: [StreamChunk(text="Hello from scripted model")])
    delay: float = 0.0
    error: Exception | None = None
    error_after_chunks: int | None = None
    stream_closed: bool = False
    stream_cancelled: bool = False


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
        self.chunks_to_stream: list[StreamChunk] = [
            StreamChunk(text="Hello"),
            StreamChunk(text=" from"),
            StreamChunk(text=" Chat-Brain!"),
        ]
        self.stream_delay: float = 0.0
        self.stream_error: Exception | None = None
        self.stream_error_after_chunks: int | None = None
        self.recorded_calls: list[dict[str, Any]] = []
        self.model_scripts: dict[str, ModelScript] = {}
        self.stream_closed: bool = False
        self.stream_cancelled: bool = False

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

    async def stream_chat(
        self,
        api_key: str,
        model_id: str,
        messages: list[dict[str, Any]],
        system_instruction: str | None = None,
    ) -> AsyncIterator[StreamChunk]:
        self.validate_key(api_key)
        self.recorded_calls.append({
            "model_id": model_id,
            "messages_count": len(messages),
            "system_instruction": system_instruction,
            "first_role": messages[0]["role"] if messages else None,
        })

        script = self.model_scripts.get(model_id)
        chunks = script.chunks if script else self.chunks_to_stream
        delay = script.delay if script else self.stream_delay
        error = script.error if script else self.stream_error
        error_after = script.error_after_chunks if script else self.stream_error_after_chunks

        if error and error_after is None:
            raise error

        count = 0
        try:
            for chunk in chunks:
                if error and error_after == count:
                    raise error

                if delay > 0:
                    await asyncio.sleep(delay)

                count += 1
                if isinstance(chunk, str):
                    yield StreamChunk(text=chunk)
                else:
                    yield chunk

            if error and (error_after is None or error_after == count):
                raise error
        except (asyncio.CancelledError, GeneratorExit):
            self.stream_cancelled = True
            if script:
                script.stream_cancelled = True
            raise
        finally:
            self.stream_closed = True
            if script:
                script.stream_closed = True


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
    set_health_store(ModelHealthStore())
    set_failover_config(FailoverConfig())

    yield

    set_ai_provider(None)
    set_health_store(None)
    set_failover_config(FailoverConfig())


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
