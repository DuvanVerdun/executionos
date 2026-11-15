from typing import Any

from flask import current_app  # type: ignore[attr-defined]

from executionos.errors import error_response
from executionos.extensions import db


class UserNotAvailableError(Exception):
    """The user does not exist, is the requester, or is blocked in either direction. All three look the same."""


def social_error_response(error: Exception) -> tuple[Any, int]:
    """Map a social error to a generic response. Never expose str(error)."""
    db.session.rollback()

    if isinstance(error, UserNotAvailableError):
        return error_response("User not available", 404)

    current_app.logger.error("Social request failed", exc_info=error)
    return error_response("Social request failed", 500)
