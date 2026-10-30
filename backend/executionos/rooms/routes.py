from datetime import datetime
from typing import Any, cast

from flask import Blueprint, current_app, jsonify, request  # type: ignore[attr-defined]
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required  # type: ignore[reportUnknownVariableType]

from executionos.dashboard.service import parse_cursor_datetime, parse_timezone
from executionos.extensions import db
from executionos.rooms.service import (
    RoomConflictError,
    RoomForbiddenError,
    RoomNotAvailableError,
    create_room_for_user,
    delete_room_for_user,
    get_room_link_for_user,
    join_room_for_user,
    leave_room_for_user,
    get_room_sessions_for_user,
    get_room_snapshot_for_user,
    get_room_summary_for_user,
    list_rooms_for_user,
    refresh_room_link_for_user,
    set_show_missions_for_user,
)
from executionos.rooms.session_service import (
    RoomSessionConflictError,
    checkin_room_session_for_user,
    finalize_overdue_for_rooms,
    finalize_overdue_for_user_rooms,
    finalize_quietly,
    finish_room_session_for_user,
    get_room_session_for_user,
    heartbeat_room_session_for_user,
    pause_room_session_for_user,
    resume_room_session_for_user,
    start_room_session_for_user,
)

rooms_bp = Blueprint("rooms", __name__)


def read_json_object() -> dict[str, Any]:
    raw_data: object = request.get_json(silent=True)  # type: ignore[reportUnknownMemberType]
    if not isinstance(raw_data, dict):
        raise ValueError("A JSON object is required")
    return cast(dict[str, Any], raw_data)

def room_error_response(error: Exception) -> tuple[Any, int]:
    """Map a room error to a generic response. Never expose str(error)."""
    db.session.rollback()

    if isinstance(error, RoomNotAvailableError):
        return jsonify({"success": False, "error": "Room not available"}), 404  # type: ignore
    if isinstance(error, RoomForbiddenError):
        return jsonify({"success": False, "error": "Not allowed"}), 403  # type: ignore
    if isinstance(error, RoomSessionConflictError):
        return jsonify({**error.envelope, "success": False, "error": "Session conflict"}), 409  # type: ignore
    if isinstance(error, RoomConflictError):
        return jsonify({"success": False, "error": "A session is running"}), 409  # type: ignore
    if isinstance(error, ValueError):
        return jsonify({"success": False, "error": "Invalid room data"}), 400  # type: ignore

    current_app.logger.error("Room request failed", exc_info=error)
    return jsonify({"success": False, "error": "Room request failed"}), 500  # type: ignore

@rooms_bp.route("/api/rooms", methods=["GET"])
@jwt_required()
def get_rooms() -> tuple[Any, int]:
    """Return the rooms the authenticated user belongs to."""
    user_id = int(get_jwt_identity())
    try:
        finalize_quietly(lambda: finalize_overdue_for_user_rooms(user_id))
        return jsonify({"success": True, "rooms": list_rooms_for_user(user_id)}), 200  # type: ignore
    except Exception as error:
        return room_error_response(error)

@rooms_bp.route("/api/rooms", methods=["POST"])
@jwt_required()
def create_room() -> tuple[Any, int]:
    """Create a room owned by the authenticated user."""
    user_id = int(get_jwt_identity())
    try:
        data = read_json_object()
        room = create_room_for_user(user_id, data.get("name"))
        return jsonify({"success": True, "room": room}), 201  # type: ignore
    except Exception as error:
        return room_error_response(error)

@rooms_bp.route("/api/rooms/join", methods=["POST"])
@jwt_required()
def join_room() -> tuple[Any, int]:
    """Join a room with its link token."""
    user_id = int(get_jwt_identity())
    try:
        data = read_json_object()
        room = join_room_for_user(user_id, data.get("linkToken"))
        already_member = room.pop("already_member")
        return jsonify({  # type: ignore
            "success": True,
            "room": room,
            "already_member": already_member,
        }), 200
    except Exception as error:
        return room_error_response(error)

@rooms_bp.route("/api/rooms/<int:room_id>/leave", methods=["POST"])
@jwt_required()
def leave_room(room_id: int) -> tuple[Any, int]:
    """Leave a room. The room is deleted if nobody is left."""
    user_id = int(get_jwt_identity())
    try:
        finalize_overdue_for_rooms([room_id])
        result = leave_room_for_user(user_id, room_id)
        return jsonify({"success": True, **result}), 200  # type: ignore
    except Exception as error:
        return room_error_response(error)

@rooms_bp.route("/api/rooms/<int:room_id>", methods=["DELETE"])
@jwt_required()
def delete_room(room_id: int) -> tuple[Any, int]:
    """Delete a room. Owner only."""
    user_id = int(get_jwt_identity())
    try:
        finalize_overdue_for_rooms([room_id])
        delete_room_for_user(user_id, room_id)
        return jsonify({"success": True}), 200  # type: ignore
    except Exception as error:
        return room_error_response(error)

@rooms_bp.route("/api/rooms/<int:room_id>/link", methods=["GET"])
@jwt_required()
def get_room_link(room_id: int) -> tuple[Any, int]:
    """Return the room link token. Owner only."""
    user_id = int(get_jwt_identity())
    try:
        token = get_room_link_for_user(user_id, room_id)
        return jsonify({"success": True, "link_token": token}), 200  # type: ignore
    except Exception as error:
        return room_error_response(error)

@rooms_bp.route("/api/rooms/<int:room_id>/link/refresh", methods=["POST"])
@jwt_required()
def refresh_room_link(room_id: int) -> tuple[Any, int]:
    """Replace the room link token. Owner only."""
    user_id = int(get_jwt_identity())
    try:
        token = refresh_room_link_for_user(user_id, room_id)
        return jsonify({"success": True, "link_token": token}), 200  # type: ignore
    except Exception as error:
        return room_error_response(error)

@rooms_bp.route("/api/rooms/<int:room_id>/membership", methods=["PATCH"])
@jwt_required()
def update_membership(room_id: int) -> tuple[Any, int]:
    """Set whether the user's missions are shown in this room."""
    user_id = int(get_jwt_identity())
    try:
        data = read_json_object()
        value = set_show_missions_for_user(user_id, room_id, data.get("showMissions"))
        return jsonify({"success": True, "show_missions": value}), 200  # type: ignore
    except Exception as error:
        return room_error_response(error)

@rooms_bp.route("/api/rooms/<int:room_id>", methods=["GET"])
@jwt_required()
def get_room(room_id: int) -> tuple[Any, int]:
    """Return the room snapshot: room, summary and ranking."""
    user_id = int(get_jwt_identity())
    try:
        finalize_quietly(lambda: finalize_overdue_for_rooms([room_id]))
        snapshot = get_room_snapshot_for_user(user_id, room_id)
        return jsonify({"success": True, **snapshot}), 200  # type: ignore
    except Exception as error:
        return room_error_response(error)

@rooms_bp.route("/api/rooms/<int:room_id>/summary", methods=["GET"])
@jwt_required()
def get_room_summary(room_id: int) -> tuple[Any, int]:
    """Return the room summary numbers."""
    user_id = int(get_jwt_identity())
    try:
        raw_include = request.args.get("include_my_running_session")

        if raw_include not in (None, "true", "false"):
            raise ValueError("include_my_running_session must be true or false")

        finalize_quietly(lambda: finalize_overdue_for_rooms([room_id]))
        summary = get_room_summary_for_user(user_id, room_id, raw_include == "true")
        return jsonify({"success": True, "summary": summary}), 200  # type: ignore
    except Exception as error:
        return room_error_response(error)

@rooms_bp.route("/api/rooms/<int:room_id>/sessions", methods=["GET"])
@jwt_required()
def get_room_sessions(room_id: int) -> tuple[Any, int]:
    """Return a page of room history and daily summaries."""
    user_id = int(get_jwt_identity())
    try:
        timezone = parse_timezone(request.args.get("timezone"))

        raw_cursor_date = request.args.get("cursor_date")
        raw_cursor_id = request.args.get("cursor_id")

        if (raw_cursor_date is None) != (raw_cursor_id is None):
            raise ValueError("cursor_date and cursor_id must be provided together")

        finalize_quietly(lambda: finalize_overdue_for_rooms([room_id]))

        cursor_date: datetime | None = None
        cursor_id: int | None = None

        if raw_cursor_date is not None and raw_cursor_id is not None:
            cursor_date = parse_cursor_datetime(raw_cursor_date)
            cursor_id = int(raw_cursor_id)

        result = get_room_sessions_for_user(
            user_id, room_id, timezone, cursor_date, cursor_id
        )
        return jsonify({"success": True, **result}), 200  # type: ignore
    except Exception as error:
        return room_error_response(error)

@rooms_bp.route("/api/room-session", methods=["GET"])
@jwt_required()
def get_room_session() -> tuple[Any, int]:
    """Return the authenticated user's running room session, if any."""
    user_id = int(get_jwt_identity())
    try:
        return jsonify(get_room_session_for_user(user_id)), 200  # type: ignore
    except Exception as error:
        return room_error_response(error)

@rooms_bp.route("/api/room-session", methods=["POST"])
@jwt_required()
def start_room_session() -> tuple[Any, int]:
    """Start a room session for the authenticated user."""
    user_id = int(get_jwt_identity())
    try:
        data = read_json_object()
        envelope = start_room_session_for_user(
            user_id,
            data.get("roomId"),
            data.get("mission"),
            data.get("targetTimeSeconds"),
        )
        return jsonify(envelope), 201  # type: ignore
    except Exception as error:
        return room_error_response(error)

@rooms_bp.route("/api/room-session/pause", methods=["POST"])
@jwt_required()
def pause_room_session() -> tuple[Any, int]:
    """Pause the running room session. Stop uses the same transition."""
    user_id = int(get_jwt_identity())
    try:
        return jsonify(pause_room_session_for_user(user_id)), 200  # type: ignore
    except Exception as error:
        return room_error_response(error)

@rooms_bp.route("/api/room-session/resume", methods=["POST"])
@jwt_required()
def resume_room_session() -> tuple[Any, int]:
    """Resume the paused room session. Continue uses the same transition."""
    user_id = int(get_jwt_identity())
    try:
        return jsonify(resume_room_session_for_user(user_id)), 200  # type: ignore
    except Exception as error:
        return room_error_response(error)

@rooms_bp.route("/api/room-session/checkin", methods=["POST"])
@jwt_required()
def checkin_room_session() -> tuple[Any, int]:
    """Confirm presence for the outstanding check-in."""
    user_id = int(get_jwt_identity())
    try:
        return jsonify(checkin_room_session_for_user(user_id)), 200  # type: ignore
    except Exception as error:
        return room_error_response(error)

@rooms_bp.route("/api/room-session/heartbeat", methods=["POST"])
@jwt_required()
def heartbeat_room_session() -> tuple[Any, int]:
    """Tell the server the client is alive."""
    user_id = int(get_jwt_identity())
    try:
        return jsonify(heartbeat_room_session_for_user(user_id)), 200  # type: ignore
    except Exception as error:
        return room_error_response(error)

@rooms_bp.route("/api/room-session/finish", methods=["POST"])
@jwt_required()
def finish_room_session() -> tuple[Any, int]:
    """Save the paused room session and end it."""
    user_id = int(get_jwt_identity())
    try:
        data = read_json_object()
        return jsonify(finish_room_session_for_user(user_id, data.get("submissionId"))), 200  # type: ignore
    except Exception as error:
        return room_error_response(error)
