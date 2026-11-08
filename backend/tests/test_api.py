"""Tests for Chat-Brain core endpoints, bootstrap, and host security."""

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
    """PUT /api/v1/credentials/gemini without token is rejected with 401."""
    res = client.put("/api/v1/credentials/gemini", json={"api_key": "test-key"})
    assert res.status_code == 401
    err = res.json()
    assert "error" in err
    assert err["error"]["category"] == "auth"


def test_get_credentials_with_token_works(client: TestClient, auth_headers: dict[str, str]) -> None:
    """GET /api/v1/credentials/gemini with token returns credential status."""
    res = client.get("/api/v1/credentials/gemini", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "configured" in data
    assert isinstance(data["configured"], bool)


def test_removed_endpoints_return_404(client: TestClient) -> None:
    """Removed endpoints must return 404."""
    assert client.get("/api/v1/status").status_code == 404
    assert client.get("/api/v1/settings").status_code == 404
    assert client.get("/api/v1/models/pool").status_code == 404
    assert client.get("/api/v1/models/failovers").status_code == 404


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
