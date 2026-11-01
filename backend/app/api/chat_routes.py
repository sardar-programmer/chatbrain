"""FastAPI endpoints for Chat Conversations and Messages (M1.3a)."""

import sqlite3
from typing import Any
from fastapi import APIRouter, Depends, Query
from app.db.database import get_db
from app.errors import NotFoundException
from app.schemas.chat import (
    ConversationClearResponse,
    ConversationCreatePayload,
    ConversationDeleteResponse,
    ConversationDetailResponse,
    ConversationListResponse,
    ConversationRestoreManyPayload,
    ConversationRestoreManyResponse,
    ConversationUpdatePayload,
    MessageCreatePayload,
    MessageEditPayload,
    MessageEditResponse,
    MessageItemResponse,
)
from app.security import verify_token
from app.services.chat import chat_store
from app.services.chat.chat_helpers import validate_uuid

router = APIRouter(prefix="/api/v1", dependencies=[Depends(verify_token)])


@router.get("/conversations", response_model=ConversationListResponse)
def list_conversations(
    search: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = None,
    conn: sqlite3.Connection = Depends(get_db),
) -> Any:
    """List conversations ordered by pinned DESC, updated_at DESC."""
    return chat_store.list_conversations(conn, search=search, limit=limit, cursor=cursor)


@router.post("/conversations", response_model=ConversationDetailResponse, status_code=201)
def create_conversation(
    payload: ConversationCreatePayload | None = None,
    conn: sqlite3.Connection = Depends(get_db),
) -> Any:
    """Create a new conversation with optional title."""
    title = payload.title if payload else None
    return chat_store.create_conversation(conn, title=title)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conversation_id: str,
    conn: sqlite3.Connection = Depends(get_db),
) -> Any:
    """Retrieve conversation details and ordered messages."""
    valid_id = validate_uuid(conversation_id)
    conv = chat_store.get_conversation(conn, valid_id)
    if not conv:
        raise NotFoundException("Conversation not found")
    return conv


@router.patch("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
def update_conversation(
    conversation_id: str,
    payload: ConversationUpdatePayload,
    conn: sqlite3.Connection = Depends(get_db),
) -> Any:
    """Rename or pin/unpin conversation without updating updated_at."""
    valid_id = validate_uuid(conversation_id)
    return chat_store.update_conversation(
        conn,
        valid_id,
        title=payload.title,
        pinned=payload.pinned,
    )


@router.delete("/conversations/{conversation_id}", response_model=ConversationDeleteResponse)
def delete_conversation(
    conversation_id: str,
    conn: sqlite3.Connection = Depends(get_db),
) -> Any:
    """Soft delete a conversation."""
    valid_id = validate_uuid(conversation_id)
    return chat_store.delete_conversation(conn, valid_id)


@router.post("/conversations/{conversation_id}/restore", response_model=ConversationDetailResponse)
def restore_conversation(
    conversation_id: str,
    conn: sqlite3.Connection = Depends(get_db),
) -> Any:
    """Restore a soft-deleted conversation."""
    valid_id = validate_uuid(conversation_id)
    return chat_store.restore_conversation(conn, valid_id)


@router.post("/conversations/clear", response_model=ConversationClearResponse)
def clear_all_conversations(
    conn: sqlite3.Connection = Depends(get_db),
) -> Any:
    """Soft-delete all non-deleted conversations."""
    ids = chat_store.clear_all_conversations(conn)
    return {"ids": ids}


@router.post("/conversations/restore", response_model=ConversationRestoreManyResponse)
def restore_many_conversations(
    payload: ConversationRestoreManyPayload,
    conn: sqlite3.Connection = Depends(get_db),
) -> Any:
    """Restore multiple soft-deleted conversations by IDs."""
    valid_ids = [validate_uuid(cid) for cid in payload.ids]
    restored = chat_store.restore_many_conversations(conn, valid_ids)
    return {"restored": restored}


@router.post("/conversations/{conversation_id}/messages", response_model=MessageItemResponse, status_code=201)
def add_user_message(
    conversation_id: str,
    payload: MessageCreatePayload,
    conn: sqlite3.Connection = Depends(get_db),
) -> Any:
    """Add a user message to a conversation."""
    valid_id = validate_uuid(conversation_id)
    return chat_store.add_user_message(
        conn,
        valid_id,
        content=payload.content,
        attachments=payload.attachments,
    )


@router.patch("/messages/{message_id}", response_model=MessageEditResponse)
def edit_user_message(
    message_id: str,
    payload: MessageEditPayload,
    conn: sqlite3.Connection = Depends(get_db),
) -> Any:
    """Edit user message, deleting subsequent messages."""
    valid_id = validate_uuid(message_id)
    msg, removed_count = chat_store.edit_user_message(conn, valid_id, payload.content)
    return {"message": msg, "removed_count": removed_count}
