from typing import Any

from flask import Blueprint, jsonify, request  # type: ignore[attr-defined]
from flask_jwt_extended import get_jwt_identity, jwt_required  # type: ignore[reportUnknownVariableType]

from executionos.errors import error_response, server_error
from executionos.params import parse_timezone, read_json_object
from executionos.social.errors import social_error_response
from executionos.social.presence import clear_presence_for_user, report_presence_for_user
from executionos.social.queries import get_following_for_user, get_profile_for_user, search_users_for_user
from executionos.social.service import (
    accept_follow_request_for_user,
    block_user_for_user,
    decline_follow_request_for_user,
    follow_user_for_user,
    list_blocked_for_user,
    unblock_user_for_user,
    unfollow_user_for_user,
)

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


@social_bp.route("/api/users/<username>/follow", methods=["PUT"])
@jwt_required()
def follow_user(username: str) -> tuple[Any, int]:
    """Follow a user, or send a request when their account is private."""
    try:
        status = follow_user_for_user(int(get_jwt_identity()), username)
        return jsonify({"success": True, "follow_status": status}), 200  # type: ignore
    except Exception as error:
        return social_error_response(error)


@social_bp.route("/api/users/<username>/follow", methods=["DELETE"])
@jwt_required()
def unfollow_user(username: str) -> tuple[Any, int]:
    """Stop following a user, or take back a request."""
    try:
        unfollow_user_for_user(int(get_jwt_identity()), username)
        return jsonify({"success": True}), 200  # type: ignore
    except Exception as error:
        return social_error_response(error)


@social_bp.route("/api/follow-requests/<username>/accept", methods=["POST"])
@jwt_required()
def accept_follow_request(username: str) -> tuple[Any, int]:
    """Accept the request that a user sent to the authenticated user."""
    try:
        accept_follow_request_for_user(int(get_jwt_identity()), username)
        return jsonify({"success": True}), 200  # type: ignore
    except Exception as error:
        return social_error_response(error)


@social_bp.route("/api/follow-requests/<username>", methods=["DELETE"])
@jwt_required()
def decline_follow_request(username: str) -> tuple[Any, int]:
    """Decline the request that a user sent to the authenticated user."""
    try:
        decline_follow_request_for_user(int(get_jwt_identity()), username)
        return jsonify({"success": True}), 200  # type: ignore
    except Exception as error:
        return social_error_response(error)


@social_bp.route("/api/blocks", methods=["GET"])
@jwt_required()
def get_blocks() -> tuple[Any, int]:
    """Return the users the authenticated user blocked."""
    try:
        return jsonify({"success": True, "blocked": list_blocked_for_user(int(get_jwt_identity()))}), 200  # type: ignore
    except Exception as error:
        return social_error_response(error)


@social_bp.route("/api/blocks/<username>", methods=["PUT"])
@jwt_required()
def block_user(username: str) -> tuple[Any, int]:
    """Block a user."""
    try:
        block_user_for_user(int(get_jwt_identity()), username)
        return jsonify({"success": True}), 200  # type: ignore
    except Exception as error:
        return social_error_response(error)


@social_bp.route("/api/blocks/<username>", methods=["DELETE"])
@jwt_required()
def unblock_user(username: str) -> tuple[Any, int]:
    """Unblock a user."""
    try:
        unblock_user_for_user(int(get_jwt_identity()), username)
        return jsonify({"success": True}), 200  # type: ignore
    except Exception as error:
        return social_error_response(error)


@social_bp.route("/api/following", methods=["GET"])
@jwt_required()
def get_following() -> tuple[Any, int]:
    """Return the requests waiting for the authenticated user and the people they follow."""
    try:
        timezone = parse_timezone(request.args.get("timezone"))
        return jsonify({"success": True, **get_following_for_user(int(get_jwt_identity()), timezone)}), 200  # type: ignore
    except Exception as error:
        return social_error_response(error)


@social_bp.route("/api/user-search", methods=["GET"])
@jwt_required()
def search_users() -> tuple[Any, int]:
    """Return the users whose username starts with the query."""
    try:
        users = search_users_for_user(int(get_jwt_identity()), request.args.get("q", ""))
        return jsonify({"success": True, "users": users}), 200  # type: ignore
    except Exception as error:
        return social_error_response(error)


@social_bp.route("/api/users/<username>", methods=["GET"])
@jwt_required()
def get_profile(username: str) -> tuple[Any, int]:
    """Return a profile: the card, and the data when the authenticated user may see it."""
    try:
        timezone = parse_timezone(request.args.get("timezone"))
        profile = get_profile_for_user(int(get_jwt_identity()), username, timezone)
        return jsonify({"success": True, "profile": profile}), 200  # type: ignore
    except Exception as error:
        return social_error_response(error)
