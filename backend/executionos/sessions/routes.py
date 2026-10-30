from datetime import datetime
from typing import Any, cast
from uuid import UUID

from flask import Blueprint, current_app, jsonify, request  # type: ignore[attr-defined]
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required  # type: ignore[reportUnknownVariableType]
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from executionos.errors import error_response, server_error
from executionos.extensions import db
from executionos.models import Session
from executionos.params import parse_anchor_date, parse_period, parse_timezone, read_cursor
from executionos.rooms.session_service import finalize_overdue_for_users, finalize_quietly
from executionos.sessions.service import get_paginated_sessions

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
    user_id = int(get_jwt_identity())
    submission_id: str | None = None
    try:
        raw_data: object = request.get_json(silent=True)  # type: ignore[reportUnknownMemberType]
        if not isinstance(raw_data, dict):
            raise ValueError("Session data is required")
        data = cast(dict[str, Any], raw_data)
        if data.get("submissionId") is not None:
            if not isinstance(data["submissionId"], str):
                raise ValueError("Submission ID must be a UUID string")
            submission_id = str(UUID(data["submissionId"]))
            existing = db.session.execute(select(Session).filter_by(
                user_id=user_id, submission_id=submission_id
            )).scalar_one_or_none()
            if existing is not None:
                return jsonify({"success": True, "session_id": existing.id}), 200  # type: ignore
        if not isinstance(data["mission"], str) or not data["mission"].strip() or len(data["mission"]) > 200:
            raise ValueError("A mission of at most 200 characters is required")
        for field in ("targetTimeSeconds", "actualTimeSeconds"):
            value = data[field]
            if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                raise ValueError("Session times must be non-negative integers")
        if data["targetTimeSeconds"] == 0:
            raise ValueError("Target time must be greater than zero")
        if not isinstance(data["date"], str):
            raise ValueError("Session date must be an ISO string")

        new_session = Session(
            user_id=user_id,
            date=datetime.fromisoformat(data["date"].replace("Z", "+00:00")),
            mission=data["mission"],
            target_time_seconds=int(data["targetTimeSeconds"]),
            actual_time_seconds=int(data["actualTimeSeconds"])
        )
        new_session.submission_id = submission_id

        db.session.add(new_session)
        db.session.commit()

        return jsonify({  # type: ignore
            "success": True,
            "message": "Session saved",
            "session_id": new_session.id
        }), 201
    except (ValueError, TypeError, KeyError):
        db.session.rollback()
        return error_response("Invalid session data", 400)
    except IntegrityError:
        db.session.rollback()

        if submission_id is not None:
            existing = db.session.execute(select(Session).filter_by(
                user_id=user_id, submission_id=submission_id
            )).scalar_one_or_none()
            if existing is not None:
                return jsonify({"success": True, "session_id": existing.id}), 200  # type: ignore
        current_app.logger.exception("Could not save session")
        return error_response("Could not save session", 500)
    except Exception:
        return server_error("Could not save session")

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
