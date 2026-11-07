"""Dev-only fault injection wrapper around AIProvider (M1.3c)."""

import asyncio
from collections.abc import AsyncIterator
import logging
import os
from typing import Any
from app.errors import ProviderException
from app.services.ai.provider import AIProvider, ModelInfo, StreamChunk

logger = logging.getLogger("chatbrain.ai.dev_fault")


class DevFaultWrapper:
    """Wrapper that injects simulated errors and delays when CHATBRAIN_ENV=dev."""

    def __init__(self, inner: AIProvider) -> None:
        self._inner = inner
        self.fail_models: set[str] = set()
        self.slow_models: dict[str, float] = {}
        self._active = False

        if os.environ.get("CHATBRAIN_ENV") == "dev":
            fail_env = os.environ.get("CHATBRAIN_DEV_FAIL_MODELS", "").strip()
            if fail_env:
                self.fail_models = {m.strip() for m in fail_env.split(",") if m.strip()}

            slow_env = os.environ.get("CHATBRAIN_DEV_SLOW_MODELS", "").strip()
            if slow_env:
                for item in slow_env.split(","):
                    if ":" in item:
                        mid, ms_str = item.split(":", 1)
                        try:
                            self.slow_models[mid.strip()] = float(ms_str.strip()) / 1000.0
                        except ValueError:
                            pass

            if self.fail_models or self.slow_models:
                self._active = True
                active_ids = sorted(list(self.fail_models | set(self.slow_models.keys())))
                logger.warning("DEV fault injection ACTIVE: %s", ", ".join(active_ids))

    def validate_key(self, api_key: str) -> bool:
        return self._inner.validate_key(api_key)

    def list_models(self, api_key: str) -> list[ModelInfo]:
        return self._inner.list_models(api_key)

    async def stream_chat(
        self,
        api_key: str,
        model_id: str,
        messages: list[dict[str, Any]],
        system_instruction: str | None = None,
    ) -> AsyncIterator[StreamChunk]:
        if self._active:
            if "*" in self.fail_models or model_id in self.fail_models:
                raise ProviderException(
                    "Resource_Exhausted: quota exceeded for model (dev fault injection)",
                    code="quota",
                    retryable=True,
                    status_code=429,
                )
            if model_id in self.slow_models:
                await asyncio.sleep(self.slow_models[model_id])

        async for chunk in self._inner.stream_chat(api_key, model_id, messages, system_instruction):
            yield chunk


def wrap_provider_if_dev(provider: AIProvider) -> AIProvider:
    """Wrap provider with fault injection if running in dev mode."""
    if os.environ.get("CHATBRAIN_ENV") == "dev":
        return DevFaultWrapper(provider)
    return provider
