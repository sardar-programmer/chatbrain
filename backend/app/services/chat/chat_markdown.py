"""Markdown utilities and query escaping for Chat."""

import re


def strip_markdown(text: str) -> str:
    """Strip common markdown syntax and return first 120 characters."""
    if not text:
        return ""

    # 1. Remove fenced code blocks
    s = re.sub(r"```[\s\S]*?```", " ", text)
    # 2. Inline code: `code` -> code
    s = re.sub(r"`([^`]+)`", r"\1", s)
    # 3. Images: ![alt](url) -> alt
    s = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r"\1", s)
    # 4. Links: [text](url) -> text
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
    # 5. Headers: # Header
    s = re.sub(r"^\s*#+\s*", "", s, flags=re.MULTILINE)
    # 6. Blockquotes: > quote
    s = re.sub(r"^\s*>\s*", "", s, flags=re.MULTILINE)
    # 7. List markers
    s = re.sub(r"^\s*[-*+]\s+", "", s, flags=re.MULTILINE)
    s = re.sub(r"^\s*\d+\.\s+", "", s, flags=re.MULTILINE)
    # 8. Bold / italic / strikethrough
    s = re.sub(r"(\*\*|__)(.*?)\1", r"\2", s)
    s = re.sub(r"(\*|_)(.*?)\1", r"\2", s)
    s = re.sub(r"~~(.*?)~~", r"\1", s)
    # 9. HTML tags if any
    s = re.sub(r"<[^>]+>", " ", s)
    # 10. Normalize spaces
    s = re.sub(r"\s+", " ", s).strip()
    return s[:120]


def escape_like(query: str) -> str:
    """Escape % and _ and \\ for SQLite LIKE queries with ESCAPE '\\'."""
    return query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
