"""Application configuration via pydantic-settings."""

from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Chat-Brain backend settings."""

    model_config = SettingsConfigDict(env_prefix="CHATBRAIN_", extra="ignore")

    app_name: str = "Chat-Brain"
    version: str = "0.1.0"
    host: str = "127.0.0.1"
    port: int = 8000
    db_path: str = "../data/app.db"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    allowed_hosts: list[str] = [
        "localhost",
        "127.0.0.1",
        "testserver",
    ]

    def get_resolved_db_path(self) -> Path:
        """Resolve database path and ensure parent directory exists."""
        raw_path = Path(self.db_path)
        if raw_path.is_absolute():
            resolved = raw_path
        else:
            backend_dir = Path(__file__).resolve().parent.parent
            resolved = (backend_dir / raw_path).resolve()

        resolved.parent.mkdir(parents=True, exist_ok=True)
        return resolved


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
