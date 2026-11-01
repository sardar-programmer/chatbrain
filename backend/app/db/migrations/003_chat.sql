-- Migration 003: chat conversations and messages schema
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    title_source TEXT NOT NULL DEFAULT 'auto' CHECK (title_source IN ('auto', 'manual')),
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('sending', 'streaming', 'done', 'error', 'stopped')),
    model_used TEXT,
    error_category TEXT,
    attempts TEXT,
    attachments TEXT,
    created_at TEXT NOT NULL,
    edited_at TEXT,
    UNIQUE(conversation_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_conversations_lookup 
ON conversations(deleted_at, pinned, updated_at);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_seq 
ON messages(conversation_id, seq);
