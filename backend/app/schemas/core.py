"""Pydantic schemas for core, credential, and model endpoints."""

from pydantic import BaseModel, Field
from app.services.ai.provider import ModelInfo


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    db: bool


class BootstrapResponse(BaseModel):
    token: str


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
