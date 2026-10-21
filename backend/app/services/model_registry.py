"""Database repository for caching discovered models in model_registry."""

import json
import sqlite3
from app.services.ai.provider import ModelInfo


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
        models.append(
            ModelInfo(
                id=row["id"],
                display_name=row["display_name"],
                provider=row["provider"],
                capabilities=json.loads(row["capabilities"]),
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
