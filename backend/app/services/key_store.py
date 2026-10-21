"""Local key storage for provider secrets with filesystem permission protection."""

import os
from pathlib import Path

SECRETS_DIR_NAME = "secrets"
KEY_FILE_NAME = "gemini.key"


def get_secrets_dir() -> Path:
    """Return the data/secrets directory and ensure it exists."""
    backend_dir = Path(__file__).resolve().parent.parent.parent
    secrets_dir = (backend_dir.parent / "data" / SECRETS_DIR_NAME).resolve()
    secrets_dir.mkdir(parents=True, exist_ok=True)

    # Restrict permissions on POSIX systems where supported
    if os.name == "posix":
        try:
            os.chmod(secrets_dir, 0o700)
        except OSError:
            pass

    return secrets_dir


def get_gemini_key_path() -> Path:
    """Return the absolute path to gemini.key."""
    return get_secrets_dir() / KEY_FILE_NAME


def save_gemini_key(api_key: str) -> None:
    """Store the Gemini API key write-only to data/secrets/gemini.key."""
    key_path = get_gemini_key_path()
    clean_key = api_key.strip()

    # Write file
    key_path.write_text(clean_key, encoding="utf-8")

    # Restrict permissions on POSIX systems
    if os.name == "posix":
        try:
            os.chmod(key_path, 0o600)
        except OSError:
            pass


def load_gemini_key() -> str | None:
    """Load the Gemini API key from disk if configured."""
    key_path = get_gemini_key_path()
    if not key_path.exists() or not key_path.is_file():
        return None

    try:
        content = key_path.read_text(encoding="utf-8").strip()
        return content if content else None
    except OSError:
        return None


def delete_gemini_key() -> bool:
    """Delete the stored Gemini API key file."""
    key_path = get_gemini_key_path()
    if key_path.exists() and key_path.is_file():
        try:
            key_path.unlink()
            return True
        except OSError:
            return False
    return False


def get_gemini_key_hint() -> str | None:
    """Return the last 4 characters of the key as a safe hint, or null if unconfigured."""
    key = load_gemini_key()
    if not key:
        return None
    return key[-4:] if len(key) >= 4 else key
