"""Comprehensive tests for Chat-Brain backend endpoints and security."""

from collections.abc import Generator
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app.config import get_settings
from app.db.migrations import run_migrations
from app.main import app
from app.security import TOKEN_HEADER_NAME


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Generator[None, None, None]:
    """Isolate tests with a temporary SQLite database."""
    test_db = tmp_path / "test_app.db"
    settings = get_settings()
    monkeypatch.setattr(settings, "db_path", str(test_db))
    run_migrations(test_db)
    yield


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Test client instance."""
    with TestClient(app) as test_client:
        yield test_client


def test_health_ok(client: TestClient) -> None:
    """GET /api/v1/health returns status, version, and database status."""
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["version"] == "0.1.0"
    assert data["db"] is True


def test_bootstrap_returns_token(client: TestClient) -> None:
    """GET /api/v1/bootstrap returns a valid non-empty startup token."""
    res = client.get("/api/v1/bootstrap")
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    assert isinstance(data["token"], str)
    assert len(data["token"]) == 64


def test_put_without_token_returns_401(client: TestClient) -> None:
    """PUT /api/v1/settings/{key} without token is rejected with 401."""
    res = client.put("/api/v1/settings/theme", json={"value": "dark"})
    assert res.status_code == 401
    err = res.json()
    assert "error" in err
    assert err["error"]["category"] == "auth"


def test_put_with_token_works_and_persists(client: TestClient) -> None:
    """PUT /api/v1/settings/{key} with token stores setting and GET retrieves it."""
    # 1. Fetch bootstrap token
    bootstrap_res = client.get("/api/v1/bootstrap")
    token = bootstrap_res.json()["token"]
    headers = {TOKEN_HEADER_NAME: token}

    # 2. Put setting
    put_res = client.put(
        "/api/v1/settings/theme",
        json={"value": "gruvbox-dark"},
        headers=headers,
    )
    assert put_res.status_code == 200
    assert put_res.json() == {"key": "theme", "value": "gruvbox-dark"}

    # 3. Get settings with token
    get_res = client.get("/api/v1/settings", headers=headers)
    assert get_res.status_code == 200
    settings = get_res.json()["settings"]
    assert settings.get("theme") == "gruvbox-dark"


def test_bad_host_rejected(client: TestClient) -> None:
    """Requests with unknown or malicious Host header return 400 validation error."""
    res = client.get("/api/v1/health", headers={"host": "attacker.evil.com"})
    assert res.status_code == 400
    err = res.json()
    assert "error" in err
    assert err["error"]["category"] == "validation"
    assert "Invalid Host header" in err["error"]["message"]


def test_running_migrations_twice_changes_nothing(tmp_path: Path) -> None:
    """Applying migrations twice is idempotent and safe."""
    isolated_db = tmp_path / "idempotent_test.db"
    first_run = run_migrations(isolated_db)
    assert len(first_run) >= 1

    second_run = run_migrations(isolated_db)
    assert second_run == []
