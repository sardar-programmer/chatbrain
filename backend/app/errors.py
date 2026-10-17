"""Standard error definitions and payload builders."""

from typing import Any
from fastapi import HTTPException


class ChatBrainException(HTTPException):
    """Base application exception returning categorized errors."""

    def __init__(
        self,
        category: str,
        message: str,
        status_code: int,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(status_code=status_code, detail=message, headers=headers)
        self.category = category
        self.message = message

    def to_dict(self) -> dict[str, Any]:
        """Serialize into standard error envelope."""
        return {
            "error": {
                "category": self.category,
                "message": self.message,
            }
        }


class ValidationException(ChatBrainException):
    """Input or header validation failure."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(category="validation", message=message, status_code=status_code)


class AuthException(ChatBrainException):
    """Authentication or token verification failure."""

    def __init__(
        self,
        message: str = "Unauthorized: invalid or missing token",
        status_code: int = 401,
    ) -> None:
        super().__init__(category="auth", message=message, status_code=status_code)


class NotFoundException(ChatBrainException):
    """Requested resource does not exist."""

    def __init__(self, message: str = "Resource not found", status_code: int = 404) -> None:
        super().__init__(category="not_found", message=message, status_code=status_code)


class InternalException(ChatBrainException):
    """Unexpected server-side error."""

    def __init__(self, message: str = "Internal server error", status_code: int = 500) -> None:
        super().__init__(category="internal", message=message, status_code=status_code)
