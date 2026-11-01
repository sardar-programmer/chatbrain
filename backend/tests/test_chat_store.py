"""Tests for chat store service layer: CRUD, ordering, auto-title, search, pagination (M1.3a)."""

import sqlite3
import pytest
from app.db.database import create_connection
from app.errors import ValidationException
from app.services.chat import chat_store


def get_test_conn() -> sqlite3.Connection:
    return create_connection()


def test_create_and_list_ordering() -> None:
    conn = get_test_conn()
    c1 = chat_store.create_conversation(conn, "First")
    t1 = "2026-11-01T10:00:00.000000+00:00"
    t2 = "2026-11-01T10:01:00.000000+00:00"
    t3 = "2026-11-01T10:02:00.000000+00:00"

    c2 = chat_store.create_conversation(conn, "Second")
    c3 = chat_store.create_conversation(conn, "Third")

    conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?;", (t1, c1["id"]))
    conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?;", (t2, c2["id"]))
    conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?;", (t3, c3["id"]))

    # Pin c1 (pinned=True means c1 will be first despite earlier updated_at)
    chat_store.update_conversation(conn, c1["id"], pinned=True)

    res = chat_store.list_conversations(conn)
    items = res["items"]
    assert items[0]["id"] == c1["id"]
    assert items[0]["pinned"] is True
    # unpinned items ordered by updated_at desc: c3 (t3) then c2 (t2)
    assert [items[1]["id"], items[2]["id"]] == [c3["id"], c2["id"]]


def test_rename_and_pin_never_change_updated_at() -> None:
    conn = get_test_conn()
    c = chat_store.create_conversation(conn, "Original")
    original_updated_at = c["updated_at"]

    # Rename
    c_renamed = chat_store.update_conversation(conn, c["id"], title="Renamed")
    assert c_renamed["title"] == "Renamed"
    assert c_renamed["title_source"] == "manual"
    assert c_renamed["updated_at"] == original_updated_at

    # Pin
    c_pinned = chat_store.update_conversation(conn, c["id"], pinned=True)
    assert c_pinned["pinned"] is True
    assert c_pinned["updated_at"] == original_updated_at


def test_adding_message_updates_updated_at_and_auto_title() -> None:
    conn = get_test_conn()
    c = chat_store.create_conversation(conn)  # auto title
    assert c["title"] == "New chat"
    assert c["title_source"] == "auto"

    past_time = "2026-11-01T10:00:00.000000+00:00"
    conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?;", (past_time, c["id"]))

    msg = chat_store.add_user_message(
        conn,
        c["id"],
        "Hello world! This is a test message to verify auto titling feature.",
    )
    assert msg["seq"] == 1
    assert msg["role"] == "user"

    updated_conv = chat_store.get_conversation(conn, c["id"])
    assert updated_conv is not None
    assert updated_conv["updated_at"] > past_time
    assert updated_conv["title"].startswith("Hello world!")
    assert len(updated_conv["title"]) <= 40
    assert updated_conv["title_source"] == "auto"

    # Manual title should never be overwritten by subsequent user messages
    chat_store.update_conversation(conn, c["id"], title="Strict Manual Title")
    chat_store.add_user_message(conn, c["id"], "Another message shouldn't change title.")
    refreshed = chat_store.get_conversation(conn, c["id"])
    assert refreshed is not None
    assert refreshed["title"] == "Strict Manual Title"
    assert refreshed["title_source"] == "manual"


def test_validation_empty_and_too_long() -> None:
    conn = get_test_conn()
    with pytest.raises(ValidationException):
        chat_store.create_conversation(conn, "   ")
    with pytest.raises(ValidationException):
        chat_store.create_conversation(conn, "a" * 201)

    c = chat_store.create_conversation(conn)
    with pytest.raises(ValidationException):
        chat_store.update_conversation(conn, c["id"], title="   ")
    with pytest.raises(ValidationException):
        chat_store.update_conversation(conn, c["id"], title="b" * 201)

    with pytest.raises(ValidationException):
        chat_store.add_user_message(conn, c["id"], "   ")
    with pytest.raises(ValidationException):
        chat_store.add_user_message(conn, c["id"], "x" * 100001)


def test_search_case_insensitive_and_escaped_wildcards() -> None:
    conn = get_test_conn()
    c1 = chat_store.create_conversation(conn, "Project Alpha 100%")
    c2 = chat_store.create_conversation(conn, "Beta test_case")
    chat_store.add_user_message(conn, c1["id"], "Detailed search content with python code")
    chat_store.add_user_message(conn, c2["id"], "Regular text")

    # Search in title case-insensitive
    res = chat_store.list_conversations(conn, search="alpha")
    assert len(res["items"]) == 1
    assert res["items"][0]["id"] == c1["id"]

    # Search in message content
    res_msg = chat_store.list_conversations(conn, search="PYTHON")
    assert len(res_msg["items"]) == 1
    assert res_msg["items"][0]["id"] == c1["id"]

    # Literal % wildcard
    res_percent = chat_store.list_conversations(conn, search="100%")
    assert len(res_percent["items"]) == 1
    assert res_percent["items"][0]["id"] == c1["id"]

    # Literal _ wildcard
    res_underscore = chat_store.list_conversations(conn, search="test_case")
    assert len(res_underscore["items"]) == 1
    assert res_underscore["items"][0]["id"] == c2["id"]


def test_pagination_with_cursor_returns_every_item_once() -> None:
    conn = get_test_conn()
    created_ids = []
    for i in range(7):
        c = chat_store.create_conversation(conn, f"Page Item {i}")
        created_ids.append(c["id"])

    chat_store.update_conversation(conn, created_ids[1], pinned=True)
    chat_store.update_conversation(conn, created_ids[4], pinned=True)

    seen_ids: list[str] = []
    cursor = None
    while True:
        page = chat_store.list_conversations(conn, limit=2, cursor=cursor)
        for item in page["items"]:
            seen_ids.append(item["id"])
        cursor = page["next_cursor"]
        if not cursor:
            break

    assert len(seen_ids) == 7
    assert len(set(seen_ids)) == 7
    assert set(seen_ids) == set(created_ids)


def test_edit_user_message_deletes_later_and_rejects_assistant() -> None:
    conn = get_test_conn()
    c = chat_store.create_conversation(conn, "Chat")
    m1 = chat_store.add_user_message(conn, c["id"], "User Msg 1")
    m2 = chat_store.create_assistant_message(conn, c["id"])
    chat_store.update_assistant_message(conn, m2["id"], content="Assistant Reply 1", status="done")
    m3 = chat_store.add_user_message(conn, c["id"], "User Msg 2")

    conv_before = chat_store.get_conversation(conn, c["id"])
    assert conv_before is not None
    assert len(conv_before["messages"]) == 3

    # Edit m1
    updated_m1, removed = chat_store.edit_user_message(conn, m1["id"], "Edited User Msg 1")
    assert updated_m1["content"] == "Edited User Msg 1"
    assert updated_m1["edited_at"] is not None
    assert removed == 2  # m2 and m3 deleted

    conv_after = chat_store.get_conversation(conn, c["id"])
    assert conv_after is not None
    assert len(conv_after["messages"]) == 1
    assert conv_after["messages"][0]["id"] == m1["id"]

    # Reject editing assistant message
    asst_msg = chat_store.create_assistant_message(conn, c["id"])
    with pytest.raises(ValidationException):
        chat_store.edit_user_message(conn, asst_msg["id"], "Cannot edit assistant")
