"""Pydantic schemas for core, credential, and model endpoints."""

from pydantic import BaseModel, Field
from app.services.ai.provider import ModelInfo


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    db: bool


class BootstrapResponse(BaseModel):
    token: str


class SettingPayload(BaseModel):
    value: str = Field(..., description="String value to store for the given key")


class SettingItemResponse(BaseModel):
    key: str
    value: str


class SettingsResponse(BaseModel):
    settings: dict[str, str]


class GeminiCredentialResponse(BaseModel):
    configured: bool
    hint: str | None = None


class GeminiCredentialPutPayload(BaseModel):
    api_key: str = Field(..., min_length=1, description="Gemini API Key")


class GeminiTestResponse(BaseModel):
    ok: bool
    message: str


class DefaultChatModelStatus(BaseModel):
    model_id: str | None = None
    valid: bool
    reason: str | None = None


class ModelWithKind(ModelInfo):
    """ModelInfo enriched with computed kind fields."""

    kind: str
    kind_inferred: bool


class ModelsListResponse(BaseModel):
    models: list[ModelWithKind]
    connected: bool
    default_chat_model: DefaultChatModelStatus | None = None


class DefaultModelPayload(BaseModel):
    model_id: str = Field(..., min_length=1)
    force: bool = False


class ProviderErrorInfo(BaseModel):
    category: str
    at: str


class StatusResponse(BaseModel):
    api: str
    db: bool
    python_version: str
    key_configured: bool
    models_count: int
    models_last_checked: str | None = None
    default_chat_model: DefaultChatModelStatus | None = None
    last_provider_success_at: str | None = None
    last_provider_error: ProviderErrorInfo | None = None
