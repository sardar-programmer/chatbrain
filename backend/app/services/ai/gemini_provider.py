"""Official Google GenAI SDK provider implementation for Gemini models."""

from collections.abc import AsyncIterator
from datetime import datetime, timezone
import logging
from typing import Any
from google import genai
from app.errors import ProviderException
from app.services.ai.error_classifier import classify_provider_error
from app.services.ai.provider import ModelInfo, StreamChunk, derive_capabilities

logger = logging.getLogger("chatbrain.ai.gemini")


class GeminiProvider:
    """Gemini provider using official google-genai SDK."""

    provider_name: str = "gemini"

    def _create_client(self, api_key: str) -> genai.Client:
        """Create a genai.Client instance with the given key."""
        clean_key = api_key.strip()
        if not clean_key:
            raise ProviderException("Empty API key provided", code="invalid_key", status_code=400)
        return genai.Client(api_key=clean_key)

    def _handle_error(self, exc: Exception) -> None:
        """Translate upstream SDK errors to sanitized ProviderExceptions."""
        classified = classify_provider_error(exc)
        status_code = 400 if classified.code in ("invalid_key", "bad_request") else 502
        if classified.code == "quota":
            status_code = 429
        elif classified.code == "timeout":
            status_code = 504
        raise ProviderException(
            message=classified.message,
            code=classified.code,
            retryable=classified.retryable,
            status_code=status_code,
        ) from exc

    def validate_key(self, api_key: str) -> bool:
        """Validate API key by attempting to query one model item."""
        try:
            client = self._create_client(api_key)
            iterator = iter(client.models.list())
            try:
                next(iterator)
            except StopIteration:
                pass
            return True
        except Exception as exc:
            self._handle_error(exc)
            return False

    def list_models(self, api_key: str) -> list[ModelInfo]:
        """Discover and return normalized models from Gemini API."""
        try:
            client = self._create_client(api_key)
            models_list = client.models.list()
            now_iso = datetime.now(timezone.utc).isoformat()
            result: list[ModelInfo] = []

            for m in models_list:
                raw_id = getattr(m, "name", "") or ""
                model_id = raw_id.removeprefix("models/") if raw_id.startswith("models/") else raw_id
                display_name = getattr(m, "display_name", "") or model_id
                description = getattr(m, "description", "") or ""
                supported_actions = list(getattr(m, "supported_actions", []) or [])
                capabilities = derive_capabilities(
                    supported_actions=supported_actions,
                    metadata={"description": description},
                )

                result.append(
                    ModelInfo(
                        id=model_id,
                        display_name=display_name,
                        provider=self.provider_name,
                        capabilities=capabilities,
                        input_token_limit=getattr(m, "input_token_limit", None),
                        output_token_limit=getattr(m, "output_token_limit", None),
                        supported_actions=supported_actions,
                        status="available",
                        last_checked=now_iso,
                    )
                )

            return result
        except Exception as exc:
            self._handle_error(exc)
            return []

    async def stream_chat(
        self,
        api_key: str,
        model_id: str,
        messages: list[dict[str, Any]],
        system_instruction: str | None = None,
    ) -> AsyncIterator[StreamChunk]:
        """Stream chat completion chunks asynchronously via google-genai SDK."""
        try:
            client = self._create_client(api_key)
            config: dict[str, Any] = {}
            if system_instruction:
                config["system_instruction"] = system_instruction

            # Format contents into Gemini [{role, parts: [{text}]}]
            contents: list[dict[str, Any]] = []
            for msg in messages:
                role = "model" if msg.get("role") in ("model", "assistant") else "user"
                content_text = msg.get("content", "")
                parts = msg.get("parts") or [{"text": content_text}]
                contents.append({"role": role, "parts": parts})

            response_stream = await client.aio.models.generate_content_stream(
                model=model_id,
                contents=contents,
                config=config if config else None,
            )

            async for chunk in response_stream:
                finish_reason = None
                if getattr(chunk, "candidates", None) and len(chunk.candidates) > 0:
                    fr = getattr(chunk.candidates[0], "finish_reason", None)
                    if fr:
                        finish_reason = str(fr)
                text_delta = getattr(chunk, "text", "") or ""
                yield StreamChunk(text=text_delta, finish_reason=finish_reason)
        except Exception as exc:
            self._handle_error(exc)
