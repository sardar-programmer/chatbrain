"""Pydantic request and response schemas for Chat (M1.3a)."""

from typing import Any
from pydantic import BaseModel, Field


class ConversationCreatePayload(BaseModel):
    """Payload to create a new conversation."""

    title: str | None = Field(default=None, max_length=200)


class ConversationUpdatePayload(BaseModel):
    """Payload to update/rename/pin a conversation."""

    title: str | None = Field(default=None, max_length=200)
    pinned: bool | None = None


class ConversationRestoreManyPayload(BaseModel):
    """Payload to restore multiple soft-deleted conversations."""

    ids: list[str] = Field(..., min_length=1)


class ConversationReplyPayload(BaseModel):
    """Payload to trigger assistant reply stream."""

    content: str | None = Field(default=None, max_length=100000)
    regenerate: bool = False


class MessageCreatePayload(BaseModel):
    """Payload to create a user message."""

    content: str = Field(..., min_length=1, max_length=100000)
    attachments: list[dict[str, Any]] | None = None


class MessageEditPayload(BaseModel):
    """Payload to edit a user message."""

    content: str = Field(..., min_length=1, max_length=100000)


class MessageItemResponse(BaseModel):
    """Detailed message item representation."""

    id: str
    conversation_id: str
    seq: int
    role: str
    content: str
    status: str
    model_used: str | None = None
    error_category: str | None = None
    attempts: list[dict[str, Any]] | None = None
    attachments: list[dict[str, Any]] | None = None
    created_at: str
    edited_at: str | None = None


class ConversationDetailResponse(BaseModel):
    """Conversation detail including ordered messages."""

    id: str
    title: str
    title_source: str
    pinned: bool
    created_at: str
    updated_at: str
    deleted_at: str | None = None
    messages: list[MessageItemResponse] = Field(default_factory=list)


class ConversationListItem(BaseModel):
    """Summary item for conversation lists."""

    id: str
    title: str
    pinned: bool
    created_at: str
    updated_at: str
    message_count: int
    preview: str


class ConversationListResponse(BaseModel):
    """Paginated list of conversations."""

    items: list[ConversationListItem]
    next_cursor: str | None = None


class ConversationDeleteResponse(BaseModel):
    """Soft deletion confirmation."""

    id: str
    deleted_at: str


class ConversationClearResponse(BaseModel):
    """Soft-delete all conversations confirmation."""

    ids: list[str]


class ConversationRestoreManyResponse(BaseModel):
    """Multi-restore confirmation."""

    restored: list[str]


class MessageEditResponse(BaseModel):
    """Response returned upon editing a message."""

    message: MessageItemResponse
    removed_count: int
