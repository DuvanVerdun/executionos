from typing import Any

from flask import current_app, jsonify  # type: ignore[attr-defined]

from executionos.errors import error_response
from executionos.extensions import db


class RoomNotAvailableError(Exception):
    """The room does not exist, or the user may not know about it."""


class RoomForbiddenError(Exception):
    """An active member tried an owner-only action."""


class RoomConflictError(Exception):
    """The action is not possible while a room session is running."""


class RoomSessionConflictError(Exception):
    """A room-session request that conflicts with the current state. Carries the envelope."""

    def __init__(self, envelope: dict[str, Any]) -> None:
        super().__init__("Room session conflict")
        self.envelope = envelope


def room_error_response(error: Exception) -> tuple[Any, int]:
    """Map a room error to a generic response. Never expose str(error)."""
    db.session.rollback()

    if isinstance(error, RoomNotAvailableError):
        return error_response("Room not available", 404)
    if isinstance(error, RoomForbiddenError):
        return error_response("Not allowed", 403)
    if isinstance(error, RoomSessionConflictError):
        return jsonify({**error.envelope, "success": False, "error": "Session conflict"}), 409  # type: ignore
    if isinstance(error, RoomConflictError):
        return error_response("A session is running", 409)
    if isinstance(error, ValueError):
        return error_response("Invalid room data", 400)

    current_app.logger.error("Room request failed", exc_info=error)
    return error_response("Room request failed", 500)
