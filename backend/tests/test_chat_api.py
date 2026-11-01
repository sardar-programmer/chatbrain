"""Tests for chat HTTP endpoints (M1.3a)."""

import uuid
from fastapi.testclient import TestClient


def test_chat_endpoints_require_token(client: TestClient) -> None:
    # GET conversations without token
    res_get = client.get("/api/v1/conversations")
    assert res_get.status_code == 401
    assert res_get.json()["error"]["category"] == "auth"

    # POST conversations without token
    res_post = client.post("/api/v1/conversations", json={"title": "Test"})
    assert res_post.status_code == 401
    assert res_post.json()["error"]["category"] == "auth"


def test_invalid_uuid_returns_422_and_unknown_returns_404(
    authed_client: tuple[TestClient, dict[str, str]]
) -> None:
    client, headers = authed_client

    # Invalid UUID format -> 422
    res_invalid = client.get("/api/v1/conversations/not-a-valid-uuid", headers=headers)
    assert res_invalid.status_code == 422
    assert res_invalid.json()["error"]["category"] == "validation"

    # Valid UUID format but unknown -> 404
    non_existent = str(uuid.uuid4())
    res_unknown = client.get(f"/api/v1/conversations/{non_existent}", headers=headers)
    assert res_unknown.status_code == 404
    assert res_unknown.json()["error"]["category"] == "not_found"


def test_conversation_crud_and_messages_api_flow(
    authed_client: tuple[TestClient, dict[str, str]]
) -> None:
    client, headers = authed_client

    # 1. Create conversation
    create_res = client.post(
        "/api/v1/conversations",
        json={"title": "API Test Chat"},
        headers=headers,
    )
    assert create_res.status_code == 201
    conv = create_res.json()
    conv_id = conv["id"]
    assert conv["title"] == "API Test Chat"
    assert conv["pinned"] is False

    # 2. Add user message
    msg_res = client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        json={"content": "First message from API"},
        headers=headers,
    )
    assert msg_res.status_code == 201
    msg1 = msg_res.json()
    msg1_id = msg1["id"]
    assert msg1["seq"] == 1
    assert msg1["role"] == "user"

    # 3. Add second user message
    msg2_res = client.post(
        f"/api/v1/conversations/{conv_id}/messages",
        json={"content": "Second message from API"},
        headers=headers,
    )
    assert msg2_res.status_code == 201
    assert msg2_res.json()["seq"] == 2

    # 4. Get conversation with messages
    get_res = client.get(f"/api/v1/conversations/{conv_id}", headers=headers)
    assert get_res.status_code == 200
    assert len(get_res.json()["messages"]) == 2

    # 5. Patch conversation (pin and rename)
    patch_res = client.patch(
        f"/api/v1/conversations/{conv_id}",
        json={"title": "Renamed API Chat", "pinned": True},
        headers=headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["title"] == "Renamed API Chat"
    assert patch_res.json()["pinned"] is True

    # 6. Edit first message -> deletes second message
    edit_res = client.patch(
        f"/api/v1/messages/{msg1_id}",
        json={"content": "Updated first message"},
        headers=headers,
    )
    assert edit_res.status_code == 200
    edit_data = edit_res.json()
    assert edit_data["message"]["content"] == "Updated first message"
    assert edit_data["removed_count"] == 1

    # Verify conversation now only has 1 message
    verify_res = client.get(f"/api/v1/conversations/{conv_id}", headers=headers)
    assert len(verify_res.json()["messages"]) == 1

    # 7. Delete conversation (soft delete)
    del_res = client.delete(f"/api/v1/conversations/{conv_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["id"] == conv_id

    # 8. Get soft-deleted returns 404
    get_del = client.get(f"/api/v1/conversations/{conv_id}", headers=headers)
    assert get_del.status_code == 404

    # 9. Restore conversation
    restore_res = client.post(f"/api/v1/conversations/{conv_id}/restore", headers=headers)
    assert restore_res.status_code == 200
    assert restore_res.json()["id"] == conv_id


def test_clear_and_restore_many_api(
    authed_client: tuple[TestClient, dict[str, str]]
) -> None:
    client, headers = authed_client

    c1 = client.post("/api/v1/conversations", json={"title": "Batch 1"}, headers=headers).json()
    c2 = client.post("/api/v1/conversations", json={"title": "Batch 2"}, headers=headers).json()

    # Clear all
    clear_res = client.post("/api/v1/conversations/clear", headers=headers)
    assert clear_res.status_code == 200
    assert c1["id"] in clear_res.json()["ids"]
    assert c2["id"] in clear_res.json()["ids"]

    # Verify list is empty
    list_res = client.get("/api/v1/conversations", headers=headers)
    assert len(list_res.json()["items"]) == 0

    # Restore batch
    restore_res = client.post(
        "/api/v1/conversations/restore",
        json={"ids": [c1["id"], c2["id"]]},
        headers=headers,
    )
    assert restore_res.status_code == 200
    assert set(restore_res.json()["restored"]) == {c1["id"], c2["id"]}

    # Verify restored in list
    refreshed_list = client.get("/api/v1/conversations", headers=headers)
    assert len(refreshed_list.json()["items"]) == 2
