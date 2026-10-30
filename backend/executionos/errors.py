from typing import Any

from flask import current_app, jsonify  # type: ignore[attr-defined]

from executionos.extensions import db


def error_response(message: str, status: int) -> tuple[Any, int]:
    """The one shape every failure answer has: success false and a generic message."""
    return jsonify({"success": False, "error": message}), status  # type: ignore


def server_error(message: str) -> tuple[Any, int]:
    """For an unexpected failure: roll back, log the real error on the server, answer with a generic 500.

    Call it inside an `except` block, so the log gets the full traceback.
    """
    db.session.rollback()
    current_app.logger.exception(message)
    return error_response(message, 500)
