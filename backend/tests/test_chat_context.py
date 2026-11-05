"""Unit tests for chat context builder (M1.3b)."""

from app.services.chat.chat_context import build_chat_context


def test_drops_empty_and_error_empty_messages() -> None:
    messages = [
        {"role": "user", "content": "Hello", "status": "done"},
        {"role": "assistant", "content": "   ", "status": "error"},
        {"role": "assistant", "content": "", "status": "streaming"},
        {"role": "assistant", "content": "I am here", "status": "done"},
    ]
    context = build_chat_context(messages)
    assert len(context) == 2
    assert context[0]["role"] == "user"
    assert context[0]["content"] == "Hello"
    assert context[1]["role"] == "model"
    assert context[1]["content"] == "I am here"


def test_keeps_partial_stopped_assistant_text() -> None:
    messages = [
        {"role": "user", "content": "Tell me a joke", "status": "done"},
        {"role": "assistant", "content": "Why did the chicken cross", "status": "stopped"},
        {"role": "user", "content": "Go on", "status": "done"},
    ]
    context = build_chat_context(messages)
    assert len(context) == 3
    assert context[1]["role"] == "model"
    assert context[1]["content"] == "Why did the chicken cross"


def test_window_last_30_and_starts_with_user_message() -> None:
    # 40 alternating messages starting with user
    raw = []
    for i in range(40):
        role = "user" if i % 2 == 0 else "assistant"
        raw.append({"role": role, "content": f"Msg {i}", "status": "done"})

    context = build_chat_context(raw)
    # raw[-30:] starts with an assistant message (index 10 is user, index 11 is assistant -> index 10 to 39 has length 30, index 10 is user)
    assert len(context) <= 30
    assert context[0]["role"] == "user"

    # Test when the 30-message slice would start with an assistant
    raw_start_asst = [{"role": "user", "content": "Initial", "status": "done"}]
    for i in range(1, 35):
        role = "assistant" if i % 2 == 1 else "user"
        raw_start_asst.append({"role": role, "content": f"M {i}", "status": "done"})

    # raw_start_asst[-30:] index 5 is assistant. The builder should drop leading assistant messages.
    ctx = build_chat_context(raw_start_asst)
    assert ctx[0]["role"] == "user"
    assert len(ctx) <= 30
