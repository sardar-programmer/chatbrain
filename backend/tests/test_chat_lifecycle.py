"""Tests for chat lifecycle, soft delete, purge, and recovery (M1.3a)."""

from datetime import datetime, timedelta, timezone
from app.db.database import create_connection
from app.services.chat import chat_store


def test_soft_delete_and_restore_preserves_attributes() -> None:
    conn = create_connection()
    c = chat_store.create_conversation(conn, "To Delete")
    chat_store.update_conversation(conn, c["id"], pinned=True)
    c_before = chat_store.get_conversation(conn, c["id"])
    assert c_before is not None

    del_res = chat_store.delete_conversation(conn, c["id"])
    assert del_res["id"] == c["id"]
    assert del_res["deleted_at"] is not None

    assert chat_store.get_conversation(conn, c["id"]) is None
    listed = chat_store.list_conversations(conn)
    assert all(item["id"] != c["id"] for item in listed["items"])

    # Restore
    restored = chat_store.restore_conversation(conn, c["id"])
    assert restored["id"] == c["id"]
    assert restored["deleted_at"] is None
    assert restored["created_at"] == c_before["created_at"]
    assert restored["updated_at"] == c_before["updated_at"]
    assert restored["pinned"] == c_before["pinned"]


def test_clear_and_restore_many_round_trip() -> None:
    conn = create_connection()
    c1 = chat_store.create_conversation(conn, "C1")
    c2 = chat_store.create_conversation(conn, "C2")

    cleared_ids = chat_store.clear_all_conversations(conn)
    assert set(cleared_ids) == {c1["id"], c2["id"]}
    assert chat_store.list_conversations(conn)["items"] == []

    restored_ids = chat_store.restore_many_conversations(conn, [c1["id"], c2["id"]])
    assert set(restored_ids) == {c1["id"], c2["id"]}
    assert len(chat_store.list_conversations(conn)["items"]) == 2


def test_recover_interrupted_messages_and_corrupt_json() -> None:
    conn = create_connection()
    c = chat_store.create_conversation(conn, "Interrupted")
    m = chat_store.create_assistant_message(conn, c["id"])
    chat_store.update_assistant_message(conn, m["id"], content="Partial stream text")

    recovered = chat_store.recover_interrupted_messages(conn)
    assert recovered == 1

    refreshed = chat_store.get_conversation(conn, c["id"])
    assert refreshed is not None
    assert refreshed["messages"][0]["status"] == "stopped"
    assert refreshed["messages"][0]["content"] == "Partial stream text"

    # Corrupt attempts JSON
    conn.execute("UPDATE messages SET attempts = '{corrupt json}' WHERE id = ?;", (m["id"],))
    conv_corrupt = chat_store.get_conversation(conn, c["id"])
    assert conv_corrupt is not None
    assert conv_corrupt["messages"][0]["attempts"] is None


def test_purge_old_soft_deleted_conversations_cascades_messages() -> None:
    conn = create_connection()
    c = chat_store.create_conversation(conn, "Old Deleted")
    chat_store.add_user_message(conn, c["id"], "Message to cascade delete")

    # Set deleted_at to 10 days ago
    ten_days_ago = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
    conn.execute("UPDATE conversations SET deleted_at = ? WHERE id = ?;", (ten_days_ago, c["id"]))

    purged = chat_store.purge_old_soft_deleted_conversations(conn, days=7)
    assert purged == 1

    cur = conn.cursor()
    cur.execute("SELECT COUNT(1) AS cnt FROM conversations WHERE id = ?;", (c["id"],))
    assert cur.fetchone()["cnt"] == 0
    cur.execute("SELECT COUNT(1) AS cnt FROM messages WHERE conversation_id = ?;", (c["id"],))
    assert cur.fetchone()["cnt"] == 0
