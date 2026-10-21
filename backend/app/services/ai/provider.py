"""Provider abstraction protocols and normalized model structures."""

from datetime import datetime, timezone
from typing import Any, Protocol, runtime_checkable
from pydantic import BaseModel, Field


class ModelInfo(BaseModel):
    """Normalized AI model definition."""

    id: str
    display_name: str
    provider: str
    capabilities: list[Any] = Field(default_factory=list)
    input_token_limit: int | None = None
    output_token_limit: int | None = None
    supported_actions: list[str] = Field(default_factory=list)
    status: str = "available"
    last_checked: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


def derive_capabilities(
    supported_actions: list[str],
    metadata: dict[str, Any] | None = None,
) -> list[str]:
    """Derive capabilities from API reported actions and metadata."""
    caps: list[str] = []
    actions_lower = {a.lower() for a in supported_actions}

    # generateContent -> text
    if any("generatecontent" in a for a in actions_lower):
        caps.append("text")

    # embedContent -> embeddings
    if any("embedcontent" in a for a in actions_lower):
        caps.append("embeddings")

    # Image generation
    if any(act in a for a in actions_lower for act in ("generateimages", "imagegeneration")):
        caps.append("image")

    # Video generation
    if any(act in a for a in actions_lower for act in ("generatevideos", "videogeneration")):
        caps.append("video")

    # Audio generation / TTS
    if any(act in a for a in actions_lower for act in ("generateaudio", "tts", "synthesizespeech")):
        caps.append("audio")

    # Check model metadata if provided
    if metadata:
        meta_str = str(metadata).lower()
        if "image" in meta_str and "image" not in caps:
            caps.append("image")
        if "video" in meta_str and "video" not in caps:
            caps.append("video")
        if ("audio" in meta_str or "tts" in meta_str) and "audio" not in caps:
            caps.append("audio")

    # Where API gives no information, set to unknown instead of guessing
    if not caps:
        caps = ["unknown"]

    return caps


@runtime_checkable
class AIProvider(Protocol):
    """Protocol for AI service providers."""

    def validate_key(self, api_key: str) -> bool:
        """Validate an API key with the upstream provider."""
        ...

    def list_models(self, api_key: str) -> list[ModelInfo]:
        """Discover and return normalized models from upstream provider."""
        ...


_provider_instance: AIProvider | None = None


def get_ai_provider() -> AIProvider:
    """Return configured AI provider singleton or test override."""
    global _provider_instance
    if _provider_instance is not None:
        return _provider_instance

    from app.services.ai.gemini_provider import GeminiProvider

    return GeminiProvider()


def set_ai_provider(provider: AIProvider | None) -> None:
    """Override AI provider (used extensively in test suites to prevent real network calls)."""
    global _provider_instance
    _provider_instance = provider
