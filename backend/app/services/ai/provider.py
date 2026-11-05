"""Provider abstraction protocols and normalized model structures."""

from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol, runtime_checkable
from pydantic import BaseModel, Field


@dataclass
class StreamChunk:
    """Single streaming chunk from an AI provider."""

    text: str = ""
    finish_reason: str | None = None


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


class ModelKind(BaseModel):
    """Computed model kind with inference metadata."""

    kind: str
    kind_inferred: bool


def derive_kind(
    model_id: str,
    supported_actions: list[str],
    capabilities: list[str],
) -> ModelKind:
    """Classify a model into its functional kind. Computed at read time, never stored."""
    actions_lower = {a.lower() for a in supported_actions}
    caps_lower = {c.lower() for c in capabilities}
    id_lower = model_id.lower()

    # 1. predictLongRunning -> "video" (action not video-specific => inferred)
    if "predictlongrunning" in actions_lower:
        return ModelKind(kind="video", kind_inferred=True)

    # 2. bidiGenerateMusic -> "music"
    if "bidigeneratemusic" in actions_lower:
        return ModelKind(kind="music", kind_inferred=False)

    # 3. embedContent / embedText -> "embeddings"
    if "embedcontent" in actions_lower or "embedtext" in actions_lower:
        return ModelKind(kind="embeddings", kind_inferred=False)

    # 4. generateAnswer -> "qa"
    if "generateanswer" in actions_lower:
        return ModelKind(kind="qa", kind_inferred=False)

    # 5. bidiGenerateContent only (no generateContent) -> "live"
    if "bidigeneratecontent" in actions_lower and "generatecontent" not in actions_lower:
        return ModelKind(kind="live", kind_inferred=False)

    # 6. id fragment: "transcribe"
    if "transcribe" in id_lower:
        return ModelKind(kind="transcribe", kind_inferred=True)

    # 7. id fragment: "lyria"
    if "lyria" in id_lower:
        return ModelKind(kind="music", kind_inferred=True)

    # 8. id fragments for agent-like / research / robotics
    if "antigravity" in id_lower or "computer-use" in id_lower:
        return ModelKind(kind="agent", kind_inferred=True)
    if "deep-research" in id_lower:
        return ModelKind(kind="research", kind_inferred=True)
    if "robotics" in id_lower:
        return ModelKind(kind="robotics", kind_inferred=True)

    # 9. generateContent + reported capability
    if "generatecontent" in actions_lower:
        if "image" in caps_lower:
            return ModelKind(kind="image", kind_inferred=False)
        if "audio" in caps_lower:
            return ModelKind(kind="audio", kind_inferred=False)
        # 10. generateContent otherwise -> chat
        return ModelKind(kind="chat", kind_inferred=False)

    # 11. Fallback
    return ModelKind(kind="unknown", kind_inferred=False)


def derive_capabilities(
    supported_actions: list[str],
    metadata: dict[str, Any] | None = None,
) -> list[str]:
    """Derive capabilities from API reported actions and metadata."""
    caps: list[str] = []
    actions_lower = {a.lower() for a in supported_actions}

    if any("generatecontent" in a for a in actions_lower):
        caps.append("text")

    if any("embedcontent" in a for a in actions_lower):
        caps.append("embeddings")

    if any(act in a for a in actions_lower for act in ("generateimages", "imagegeneration")):
        caps.append("image")

    if any(act in a for a in actions_lower for act in ("generatevideos", "videogeneration")):
        caps.append("video")

    if any(act in a for a in actions_lower for act in ("generateaudio", "tts", "synthesizespeech")):
        caps.append("audio")

    if metadata:
        meta_str = str(metadata).lower()
        if "image" in meta_str and "image" not in caps:
            caps.append("image")
        if "video" in meta_str and "video" not in caps:
            caps.append("video")
        if ("audio" in meta_str or "tts" in meta_str) and "audio" not in caps:
            caps.append("audio")

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

    async def stream_chat(
        self,
        api_key: str,
        model_id: str,
        messages: list[dict[str, Any]],
        system_instruction: str | None = None,
    ) -> AsyncIterator[StreamChunk]:
        """Stream chat completion chunks asynchronously."""
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
    """Override AI provider (used in test suites to prevent real network calls)."""
    global _provider_instance
    _provider_instance = provider
