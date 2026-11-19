import hashlib
import hmac
from collections.abc import Callable
from datetime import UTC, datetime
from functools import wraps
from typing import Any

from flask import Blueprint, current_app, jsonify, request  # type: ignore[attr-defined]
from sqlalchemy import select
from werkzeug.wrappers import Response

from executionos.errors import error_response, server_error
from executionos.extensions import db
from executionos.models import User
from executionos.params import parse_username, read_json_object
from executionos.sessions.service import save_session_for_user
from executionos.timeutils import as_utc_aware

admin_bp = Blueprint("admin", __name__)

ADMIN_KEY_HEADER = "X-Admin-Key"
ADMIN_KEY_MIN_LENGTH = 32
MAX_BODY_BYTES = 4096


def _digest(value: str) -> bytes:
    return hashlib.sha256(value.encode()).digest()


def _has_valid_admin_key() -> bool:
    """Whether the request carries the configured admin key. A missing or short configured key never matches."""
    expected = current_app.config.get("ADMIN_API_KEY")
    if not isinstance(expected, str) or len(expected) < ADMIN_KEY_MIN_LENGTH:
        return False

    return hmac.compare_digest(_digest(request.headers.get(ADMIN_KEY_HEADER, "")), _digest(expected))


def _is_in_the_future(raw_date: object) -> bool:
    if not isinstance(raw_date, str):
        return False

    return as_utc_aware(datetime.fromisoformat(raw_date.replace("Z", "+00:00"))) > datetime.now(UTC)


def admin_key_required(view: Callable[[], tuple[Any, int]]) -> Callable[[], tuple[Any, int]]:
    """Protect an admin route. Every failure answers a plain 404, so the route does not reveal that it exists."""
    @wraps(view)
    def guarded() -> tuple[Any, int]:
        if not _has_valid_admin_key():
            return error_response("Not found", 404)
        return view()

    return guarded


@admin_bp.after_request  # type: ignore[reportUnknownMemberType, reportUntypedFunctionDecorator]
def forbid_caching(response: Response) -> Response:
    """Admin answers are never stored by a browser or a proxy."""
    response.headers["Cache-Control"] = "no-store"
    return response


@admin_bp.route("/api/admin/sessions", methods=["POST"])
@admin_key_required
def add_session_for_user() -> tuple[Any, int]:
    """Add a finished session to a user's history, for when they missed a check-in. Needs the admin key, not their password."""
    try:
        if (request.content_length or 0) > MAX_BODY_BYTES:
            return error_response("Invalid request data", 413)

        data = read_json_object()
        username = parse_username(data.get("username"))

        user = db.session.execute(select(User).filter_by(username=username)).scalar_one_or_none()
        if user is None:
            return error_response("User not found", 404)

        if _is_in_the_future(data.get("date")):
            return error_response("Session date is in the future", 400)

        session, created = save_session_for_user(user.id, data)
        current_app.logger.warning(
            "Admin %s session %s for user %s", "added" if created else "found", session.id, user.id
        )
        return jsonify({"success": True, "session_id": session.id}), 201 if created else 200  # type: ignore
    except (ValueError, TypeError, KeyError):
        db.session.rollback()
        return error_response("Invalid session data", 400)
    except Exception:
        return server_error("Could not add session")
