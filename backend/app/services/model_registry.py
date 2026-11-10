"""Database repository for caching discovered models in model_registry."""

from datetime import datetime, timezone
import json
import sqlite3
from app.services.ai.model_health import get_health_store
from app.services.ai.provider import ModelInfo, get_ai_provider


def get_cached_models(conn: sqlite3.Connection) -> list[ModelInfo]:
    """Retrieve all cached models from SQLite model_registry."""
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, display_name, provider, capabilities, input_token_limit,
               output_token_limit, supported_actions, status, last_checked
        FROM model_registry
        ORDER BY id ASC;
        """
    )
    rows = cursor.fetchall()
    models: list[ModelInfo] = []
    for row in rows:
        raw_caps = json.loads(row["capabilities"])
        caps = raw_caps if raw_caps else ["unknown"]
        models.append(
            ModelInfo(
                id=row["id"],
                display_name=row["display_name"],
                provider=row["provider"],
                capabilities=caps,
                input_token_limit=row["input_token_limit"],
                output_token_limit=row["output_token_limit"],
                supported_actions=json.loads(row["supported_actions"]),
                status=row["status"],
                last_checked=row["last_checked"],
            )
        )
    return models


def save_cached_models(conn: sqlite3.Connection, models: list[ModelInfo]) -> None:
    """Replace cached models in model_registry inside a single transaction."""
    cursor = conn.cursor()
    cursor.execute("DELETE FROM model_registry;")
    for m in models:
        cursor.execute(
            """
            INSERT INTO model_registry (
                id, display_name, provider, capabilities, input_token_limit,
                output_token_limit, supported_actions, status, last_checked
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (
                m.id,
                m.display_name,
                m.provider,
                json.dumps(m.capabilities),
                m.input_token_limit,
                m.output_token_limit,
                json.dumps(m.supported_actions),
                m.status,
                m.last_checked,
            ),
        )
    conn.commit()


def clear_cached_models(conn: sqlite3.Connection) -> None:
    """Clear all records from model_registry."""
    cursor = conn.cursor()
    cursor.execute("DELETE FROM model_registry;")
    conn.commit()


def discover_and_cache_models(conn: sqlite3.Connection, api_key: str) -> list[ModelInfo]:
    """Fetch models from provider, cache in registry, and clear not-found cooldowns."""
    provider = get_ai_provider()
    discovered = provider.list_models(api_key)
    save_cached_models(conn, discovered)
    get_health_store().clear_not_found_cooldowns(conn)
    return discovered


def is_cache_stale(models: list[ModelInfo], max_age_seconds: float = 86400.0) -> bool:
    """Check if model cache is older than max_age_seconds (default 24h)."""
    if not models:
        return True
    timestamps: list[datetime] = []
    for m in models:
        if m.last_checked:
            try:
                dt = datetime.fromisoformat(m.last_checked)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                timestamps.append(dt)
            except Exception:
                pass
    if not timestamps:
        return True
    newest = max(timestamps)
    age = (datetime.now(timezone.utc) - newest).total_seconds()
    return age >= max_age_seconds
