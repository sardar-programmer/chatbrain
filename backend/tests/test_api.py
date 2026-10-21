"""Tests for Chat-Brain core endpoints, bootstrap, settings, and host security."""

from pathlib import Path
from fastapi.testclient import TestClient
from app.db.migrations import run_migrations


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


def test_put_with_token_works_and_persists(client: TestClient, auth_headers: dict[str, str]) -> None:
    """PUT /api/v1/settings/{key} with token stores setting and GET retrieves it."""
    put_res = client.put(
        "/api/v1/settings/theme",
        json={"value": "gruvbox-dark"},
        headers=auth_headers,
    )
    assert put_res.status_code == 200
    assert put_res.json() == {"key": "theme", "value": "gruvbox-dark"}

    get_res = client.get("/api/v1/settings", headers=auth_headers)
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


def test_proxied_host_with_port_accepted(client: TestClient) -> None:
    """Requests with localhost and port (e.g. localhost:3000) are accepted."""
    res = client.get("/api/v1/health", headers={"host": "localhost:3000"})
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_running_migrations_twice_changes_nothing(tmp_path: Path) -> None:
    """Applying migrations twice is idempotent and safe."""
    isolated_db = tmp_path / "idempotent_test.db"
    first_run = run_migrations(isolated_db)
    assert len(first_run) >= 1

    second_run = run_migrations(isolated_db)
    assert second_run == []
