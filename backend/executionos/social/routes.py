from typing import Any

from flask import Blueprint, jsonify  # type: ignore[attr-defined]
from flask_jwt_extended import get_jwt_identity, jwt_required  # type: ignore[reportUnknownVariableType]

from executionos.errors import error_response, server_error
from executionos.params import read_json_object
from executionos.social.presence import clear_presence_for_user, report_presence_for_user

social_bp = Blueprint("social", __name__)


@social_bp.route("/api/presence", methods=["PUT"])
@jwt_required()
def report_presence() -> tuple[Any, int]:
    """Store what the client says about its running session."""
    user_id = int(get_jwt_identity())
    try:
        report_presence_for_user(user_id, read_json_object())
        return jsonify({"success": True}), 200  # type: ignore
    except ValueError:
        return error_response("Invalid presence data", 400)
    except Exception:
        return server_error("Presence request failed")


@social_bp.route("/api/presence", methods=["DELETE"])
@jwt_required()
def clear_presence() -> tuple[Any, int]:
    """Forget what the client said about its session, because the session ended."""
    user_id = int(get_jwt_identity())
    try:
        clear_presence_for_user(user_id)
        return jsonify({"success": True}), 200  # type: ignore
    except Exception:
        return server_error("Presence request failed")
