-- Migration 004: model health tracking and failover events
CREATE TABLE IF NOT EXISTS model_health (
    model_id TEXT PRIMARY KEY,
    successes INTEGER NOT NULL DEFAULT 0,
    failures INTEGER NOT NULL DEFAULT 0,
    ttft_ms_ewma REAL,
    last_success_at TEXT,
    last_failure_at TEXT,
    last_error_code TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    cooldown_until TEXT
);

CREATE TABLE IF NOT EXISTS failover_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    from_model TEXT NOT NULL,
    to_model TEXT,
    code TEXT NOT NULL,
    round INTEGER NOT NULL,
    at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_failover_events_conv_msg
ON failover_events(conversation_id, message_id);
