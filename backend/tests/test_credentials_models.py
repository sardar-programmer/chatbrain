"""Comprehensive tests for Gemini credentials and models endpoints with FakeProvider."""

from fastapi.testclient import TestClient
from app.services.ai.provider import derive_capabilities
from tests.conftest import FIXTURE_MODELS, FakeProvider


def test_key_never_appears_in_response(client: TestClient, auth_headers: dict[str, str]) -> None:
    """The full secret API key must never be leaked in any response body."""
    raw_key = "valid-secret-key-1234567890"

    # 1. PUT credentials
    put_res = client.put(
        "/api/v1/credentials/gemini",
        json={"api_key": raw_key},
        headers=auth_headers,
    )
    assert put_res.status_code == 200
    assert raw_key not in put_res.text
    assert put_res.json()["hint"] == "7890"

    # 2. GET credentials
    get_res = client.get("/api/v1/credentials/gemini", headers=auth_headers)
    assert get_res.status_code == 200
    assert raw_key not in get_res.text
    assert get_res.json()["hint"] == "7890"

    # 3. POST test credentials
    test_res = client.post("/api/v1/credentials/gemini/test", headers=auth_headers)
    assert test_res.status_code == 200
    assert raw_key not in test_res.text

    # 4. GET models
    models_res = client.get("/api/v1/models", headers=auth_headers)
    assert raw_key not in models_res.text


def test_put_with_invalid_key_does_not_save(client: TestClient, auth_headers: dict[str, str]) -> None:
    """PUT with an invalid key returns a provider error and does not save the key."""
    res = client.put(
        "/api/v1/credentials/gemini",
        json={"api_key": "invalid-unauthorized-key"},
        headers=auth_headers,
    )
    assert res.status_code == 400
    err = res.json()["error"]
    assert err["category"] == "provider"
    assert "invalid-unauthorized-key" not in res.text

    # Verify key was not saved
    get_res = client.get("/api/v1/credentials/gemini", headers=auth_headers)
    assert get_res.json() == {"configured": False, "hint": None}


def test_valid_put_saves_and_get_shows_only_4_char_hint(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    """Valid PUT saves key; GET credentials shows configured=True and last 4 chars hint."""
    put_res = client.put(
        "/api/v1/credentials/gemini",
        json={"api_key": "valid-secret-key-1234567890"},
        headers=auth_headers,
    )
    assert put_res.status_code == 200
    assert put_res.json() == {"configured": True, "hint": "7890"}

    get_res = client.get("/api/v1/credentials/gemini", headers=auth_headers)
    assert get_res.status_code == 200
    assert get_res.json() == {"configured": True, "hint": "7890"}


def test_delete_removes_file_and_cache(client: TestClient, auth_headers: dict[str, str]) -> None:
    """DELETE removes the key file and completely clears the cached model registry."""
    # Setup key and refresh models
    client.put(
        "/api/v1/credentials/gemini",
        json={"api_key": "valid-secret-key-1234567890"},
        headers=auth_headers,
    )
    refresh_res = client.post("/api/v1/models/refresh", headers=auth_headers)
    assert refresh_res.status_code == 200
    assert len(refresh_res.json()["models"]) > 0

    # Delete
    del_res = client.delete("/api/v1/credentials/gemini", headers=auth_headers)
    assert del_res.status_code == 200
    assert del_res.json() == {"configured": False, "hint": None}

    # Verify models cache is cleared and connected is false
    models_res = client.get("/api/v1/models", headers=auth_headers)
    assert models_res.status_code == 200
    assert models_res.json()["models"] == []
    assert models_res.json()["connected"] is False


def test_models_empty_with_connected_false_before_key_exists(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    """Before any key is configured, /models returns empty list with connected: false."""
    res = client.get("/api/v1/models", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["models"] == []
    assert res.json()["connected"] is False


def test_refresh_stores_normalized_models_and_capabilities(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    """POST /models/refresh queries provider and saves models in registry."""
    client.put(
        "/api/v1/credentials/gemini",
        json={"api_key": "valid-secret-key-1234567890"},
        headers=auth_headers,
    )
    refresh_res = client.post("/api/v1/models/refresh", headers=auth_headers)
    assert refresh_res.status_code == 200
    data = refresh_res.json()
    assert data["connected"] is True
    assert len(data["models"]) == len(FIXTURE_MODELS)

    # Check normalized properties
    flash = next(m for m in data["models"] if m["id"] == "gemini-2.5-flash")
    assert flash["display_name"] == "Gemini 2.5 Flash"
    assert flash["provider"] == "gemini"
    assert "text" in flash["capabilities"]
    assert flash["input_token_limit"] == 1048576
    assert flash["output_token_limit"] == 8192

    # Verify GET /models retrieves the cached models from SQLite
    get_res = client.get("/api/v1/models", headers=auth_headers)
    assert get_res.status_code == 200
    assert get_res.json()["connected"] is True
    assert len(get_res.json()["models"]) == len(FIXTURE_MODELS)


def test_unknown_capabilities_stay_unknown(client: TestClient, auth_headers: dict[str, str]) -> None:
    """Models without reported actions stay with capability ['unknown'] instead of guessing."""
    client.put(
        "/api/v1/credentials/gemini",
        json={"api_key": "valid-secret-key-1234567890"},
        headers=auth_headers,
    )
    client.post("/api/v1/models/refresh", headers=auth_headers)
    res = client.get("/api/v1/models", headers=auth_headers)
    unknown_model = next(m for m in res.json()["models"] if m["id"] == "future-custom-model")
    assert unknown_model["capabilities"] == ["unknown"]
    assert unknown_model["kind"] == "unknown"

    # Direct unit test on derive_capabilities
    assert derive_capabilities([]) == ["unknown"]
    assert derive_capabilities(["generateContent"]) == ["text"]
    assert derive_capabilities(["embedContent"]) == ["embeddings"]


def test_provider_errors_map_to_right_category(
    client: TestClient,
    auth_headers: dict[str, str],
    fake_provider: FakeProvider,
) -> None:
    """Test category mapping: missing key -> auth; provider quota/network -> provider."""
    # 1. Missing key -> category auth
    res_test = client.post("/api/v1/credentials/gemini/test", headers=auth_headers)
    assert res_test.status_code == 401
    assert res_test.json()["error"]["category"] == "auth"

    res_refresh = client.post("/api/v1/models/refresh", headers=auth_headers)
    assert res_refresh.status_code == 401
    assert res_refresh.json()["error"]["category"] == "auth"

    # Configure key
    client.put(
        "/api/v1/credentials/gemini",
        json={"api_key": "valid-secret-key-1234567890"},
        headers=auth_headers,
    )

    # 2. Quota exceeded -> category provider
    fake_provider.should_fail_quota = True
    quota_res = client.post("/api/v1/credentials/gemini/test", headers=auth_headers)
    assert quota_res.status_code == 429
    assert quota_res.json()["error"]["category"] == "provider"

    # 3. Network error -> category provider
    fake_provider.should_fail_quota = False
    fake_provider.should_fail_network = True
    net_res = client.post("/api/v1/models/refresh", headers=auth_headers)
    assert net_res.status_code == 504
    assert net_res.json()["error"]["category"] == "provider"


def test_endpoints_reject_missing_token(client: TestClient) -> None:
    """Endpoints require valid X-ChatBrain-Token or return 401."""
    endpoints = [
        ("GET", "/api/v1/credentials/gemini", None),
        ("PUT", "/api/v1/credentials/gemini", {"api_key": "key"}),
        ("DELETE", "/api/v1/credentials/gemini", None),
        ("POST", "/api/v1/credentials/gemini/test", None),
        ("GET", "/api/v1/models", None),
        ("POST", "/api/v1/models/refresh", None),
    ]

    for method, path, body in endpoints:
        if method == "GET":
            res = client.get(path)
        elif method == "PUT":
            res = client.put(path, json=body)
        elif method == "DELETE":
            res = client.delete(path)
        elif method == "POST":
            res = client.post(path, json=body)
        assert res.status_code == 401, f"{method} {path} should return 401 without token"
        assert res.json()["error"]["category"] == "auth"
