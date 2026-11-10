"""Guard test: exact set of registered /api/v1 routes (C0b)."""

from fastapi.testclient import TestClient
from app.main import app


EXPECTED_ROUTES: set[tuple[str, str]] = {
    ("GET", "/api/v1/health"),
    ("GET", "/api/v1/bootstrap"),
    ("GET", "/api/v1/credentials/gemini"),
    ("PUT", "/api/v1/credentials/gemini"),
    ("DELETE", "/api/v1/credentials/gemini"),
    ("POST", "/api/v1/credentials/gemini/test"),
    ("GET", "/api/v1/models"),
    ("POST", "/api/v1/models/refresh"),
    ("GET", "/api/v1/models/health"),
    ("GET", "/api/v1/conversations"),
    ("POST", "/api/v1/conversations"),
    ("GET", "/api/v1/conversations/{conversation_id}"),
    ("PATCH", "/api/v1/conversations/{conversation_id}"),
    ("DELETE", "/api/v1/conversations/{conversation_id}"),
    ("POST", "/api/v1/conversations/{conversation_id}/restore"),
    ("POST", "/api/v1/conversations/clear"),
    ("POST", "/api/v1/conversations/restore"),
    ("POST", "/api/v1/conversations/{conversation_id}/messages"),
    ("PATCH", "/api/v1/messages/{message_id}"),
    ("POST", "/api/v1/conversations/{conversation_id}/reply"),
}


def test_exact_route_set() -> None:
    """The registered /api/v1 routes must match the expected set exactly."""
    actual: set[tuple[str, str]] = set()
    for route in app.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            path: str = route.path  # type: ignore[attr-defined]
            if path.startswith("/api/v1"):
                for method in route.methods:  # type: ignore[attr-defined]
                    if method not in ("HEAD", "OPTIONS"):
                        actual.add((method, path))

    extra = actual - EXPECTED_ROUTES
    missing = EXPECTED_ROUTES - actual
    assert not extra, f"Unexpected routes registered: {sorted(extra)}"
    assert not missing, f"Expected routes missing: {sorted(missing)}"


def test_removed_routes_return_404(client: TestClient) -> None:
    """Removed endpoints must return 404 not 405."""
    assert client.get("/api/v1/status").status_code == 404
    assert client.get("/api/v1/settings").status_code == 404
    assert client.get("/api/v1/models/pool").status_code == 404
    assert client.get("/api/v1/models/failovers").status_code == 404
    assert client.get("/api/v1/models/default").status_code == 404
    assert client.put("/api/v1/models/default").status_code in (401, 404)
    assert client.delete("/api/v1/models/default").status_code in (401, 404)
    assert client.post("/api/v1/models/health/scan").status_code in (401, 404)
    assert client.post("/api/v1/models/health/reset").status_code in (401, 404)
