-- Migration 002: model registry cache table
CREATE TABLE IF NOT EXISTS model_registry (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    provider TEXT NOT NULL,
    capabilities TEXT NOT NULL,
    input_token_limit INTEGER,
    output_token_limit INTEGER,
    supported_actions TEXT NOT NULL,
    status TEXT NOT NULL,
    last_checked TEXT NOT NULL
);
