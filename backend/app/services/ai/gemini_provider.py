"""Official Google GenAI SDK provider implementation for Gemini models."""

from datetime import datetime, timezone
import logging
from google import genai
from google.genai import errors
from app.errors import ProviderException
from app.services.ai.provider import ModelInfo, derive_capabilities

logger = logging.getLogger("chatbrain.ai.gemini")


class GeminiProvider:
    """Gemini provider using official google-genai SDK."""

    provider_name: str = "gemini"

    def _create_client(self, api_key: str) -> genai.Client:
        """Create a genai.Client instance with the given key."""
        clean_key = api_key.strip()
        if not clean_key:
            raise ProviderException("Empty API key provided", status_code=400)
        return genai.Client(api_key=clean_key)

    def _handle_error(self, exc: Exception) -> None:
        """Translate upstream SDK errors to sanitized ProviderExceptions."""
        if isinstance(exc, errors.ClientError):
            code = getattr(exc, "code", 400)
            if code == 400 or "API key not valid" in str(exc):
                raise ProviderException("Invalid Gemini API key", status_code=400) from exc
            if code == 429 or "RESOURCE_EXHAUSTED" in str(exc):
                raise ProviderException("Gemini quota or rate limit exceeded", status_code=429) from exc
            raise ProviderException("Gemini client error", status_code=400) from exc

        if isinstance(exc, errors.ServerError):
            raise ProviderException("Gemini upstream service error", status_code=502) from exc

        if isinstance(exc, (TimeoutError, ConnectionError)):
            raise ProviderException("Network error contacting Gemini API", status_code=504) from exc

        logger.warning("Unexpected Gemini error: %s", type(exc).__name__)
        raise ProviderException("Failed to communicate with Gemini provider", status_code=502) from exc

    def validate_key(self, api_key: str) -> bool:
        """Validate API key by attempting to query one model item."""
        try:
            client = self._create_client(api_key)
            # Fetch at least one item from the models iterator to verify the key
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
