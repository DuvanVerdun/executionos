from datetime import datetime
from typing import Any

from flask import current_app, jsonify  # type: ignore[attr-defined]

from executionos.errors import error_response
from executionos.extensions import db
from executionos.timeutils import utc_iso


class AccountNotFoundError(Exception):
    """The signed-in user no longer exists."""


class UsernameTakenError(Exception):
    """Another account already has that username."""


class UsernameLockedError(Exception):
    """The username was changed too recently. Carries the moment it can be changed again."""

    def __init__(self, next_change_at: datetime) -> None:
        super().__init__("Username changed too recently")
        self.next_change_at = next_change_at


class WrongPasswordError(Exception):
    """The current password sent with a password change is not the account's password."""


def account_error_response(error: Exception) -> tuple[Any, int]:
    """Map an account error to a generic response. Never expose str(error)."""
    db.session.rollback()

    if isinstance(error, AccountNotFoundError):
        return error_response("User not found", 404)
    if isinstance(error, UsernameTakenError):
        return error_response("Username already in use", 409)
    if isinstance(error, UsernameLockedError):
        return jsonify({  # type: ignore
            "success": False,
            "error": "Username cannot be changed yet",
            "next_change_at": utc_iso(error.next_change_at),
        }), 409
    if isinstance(error, WrongPasswordError):
        return error_response("Current password is incorrect", 403)
    if isinstance(error, ValueError):
        return error_response("Invalid account data", 400)

    current_app.logger.error("Account request failed", exc_info=error)
    return error_response("Account request failed", 500)
