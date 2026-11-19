from typing import Any

from flask import Blueprint, jsonify, request  # type: ignore[attr-defined]
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required  # type: ignore[reportUnknownVariableType]
from sqlalchemy import select

from executionos.errors import error_response, server_error
from executionos.extensions import db
from executionos.models import Session
from executionos.params import (
    parse_anchor_date,
    parse_mission,
    parse_period,
    parse_timezone,
    read_cursor,
    read_json_object,
)
from executionos.rooms.session_service import finalize_overdue_for_users, finalize_quietly
from executionos.sessions.service import get_paginated_sessions, save_session_for_user

sessions_bp = Blueprint("sessions", __name__)


@sessions_bp.route("/api/get-sessions", methods=["GET"])
@jwt_required()
def get_sessions() -> tuple[Any, int]:
    """Return a filtered session page and daily summaries for the authenticated user."""
    try:
        user_id = int(get_jwt_identity())
        finalize_quietly(lambda: finalize_overdue_for_users([user_id]))

        period = parse_period(request.args.get("period"))
        anchor_date = parse_anchor_date(
            request.args.get("anchor_date")
        )
        timezone = parse_timezone(
            request.args.get("timezone")
        )

        cursor_date, cursor_id = read_cursor()

        result = get_paginated_sessions(
            user_id=user_id,
            period=period,
            anchor_date=anchor_date,
            timezone=timezone,
            cursor_date=cursor_date,
            cursor_id=cursor_id,
        )

        return jsonify({  # type: ignore
            "success": True,
            **result,
        }), 200

    except ValueError as e:
        return error_response(str(e), 400)

    except Exception:
        return server_error("Could not load sessions")

@sessions_bp.route("/api/save-session", methods=["POST"])
@jwt_required()
def save_session() -> tuple[Any, int]:
    """Receive session data and save to the database."""
    try:
        session, created = save_session_for_user(int(get_jwt_identity()), read_json_object())
        if not created:
            return jsonify({"success": True, "session_id": session.id}), 200  # type: ignore
        return jsonify({  # type: ignore
            "success": True,
            "message": "Session saved",
            "session_id": session.id
        }), 201
    except (ValueError, TypeError, KeyError):
        db.session.rollback()
        return error_response("Invalid session data", 400)
    except Exception:
        return server_error("Could not save session")

@sessions_bp.route("/api/update-session/<int:session_id>", methods=["PATCH"])
@jwt_required()
def update_session(session_id: int) -> tuple[Any, int]:
    """Change the mission of a session, but only if it belongs to the requesting user. The times never change."""
    try:
        user_id = int(get_jwt_identity())
        mission = parse_mission(read_json_object().get("mission"))

        session = db.session.execute(select(Session).filter_by(id=session_id, user_id=user_id)).scalar_one_or_none()

        if session is None:
            return error_response("Session not found", 404)

        session.mission = mission
        db.session.commit()

        return jsonify({  # type: ignore
            "success": True,
            "message": "Session updated",
            "session_id": session_id,
            "mission": mission
        }), 200
    except ValueError:
        db.session.rollback()
        return error_response("Invalid session data", 400)
    except Exception:
        return server_error("Could not update session")


@sessions_bp.route("/api/delete-session/<int:session_id>", methods=["DELETE"])
@jwt_required()
def delete_session(session_id: int) -> tuple[Any, int]:
    """Delete a session, but only if it belongs to the requesting user."""
    try:
        user_id = int(get_jwt_identity())

        session = db.session.execute(select(Session).filter_by(id=session_id, user_id=user_id)).scalar_one_or_none()

        if session is None:
            return error_response("Session not found", 404)

        db.session.delete(session)
        db.session.commit()

        return jsonify({  # type: ignore
            "success": True,
            "message": "Session deleted",
            "session_id": session_id
        }), 200
    except Exception:
        return server_error("Could not delete session")
