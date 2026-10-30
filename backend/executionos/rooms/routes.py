from typing import Any

from flask import Blueprint, current_app, jsonify, request  # type: ignore[attr-defined]
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required  # type: ignore[reportUnknownVariableType]

from executionos.params import parse_timezone, read_cursor, read_json_object
from executionos.rooms.errors import room_error_response
from executionos.rooms.queries import (
    get_room_sessions_for_user,
    get_room_snapshot_for_user,
    get_room_summary_for_user,
)
from executionos.rooms.service import (
    create_room_for_user,
    delete_room_for_user,
    get_room_link_for_user,
    join_room_for_user,
    leave_room_for_user,
    list_rooms_for_user,
    refresh_room_link_for_user,
    set_show_missions_for_user,
)
from executionos.rooms.session_service import (
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

        cursor_date, cursor_id = read_cursor()

        finalize_quietly(lambda: finalize_overdue_for_rooms([room_id]))

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
