from typing import Any

from flask import Blueprint, current_app, jsonify, request  # type: ignore[attr-defined]
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required  # type: ignore[reportUnknownVariableType]

from executionos.dashboard.service import (
    get_dashboard_data,
    get_streak_data,
    parse_anchor_date,
    parse_period,
    parse_timezone,
)
from executionos.extensions import db
from executionos.rooms.session_service import finalize_overdue_for_users, finalize_quietly

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/api/streak", methods=["GET"])
@jwt_required()
def streak() -> tuple[Any, int]:
    """Return the authenticated user's streak and consistency calendar."""
    try:
        user_id = int(get_jwt_identity())
        finalize_quietly(lambda: finalize_overdue_for_users([user_id]))

        anchor_date = parse_anchor_date(
            request.args.get("anchor_date")
        )
        timezone = parse_timezone(
            request.args.get("timezone")
        )

        streak_data = get_streak_data(
            user_id=user_id,
            anchor_date=anchor_date,
            timezone=timezone,
        )

        return jsonify({  # type: ignore
            "success": True,
            **streak_data,
        }), 200

    except ValueError as e:
        return jsonify({  # type: ignore
            "success": False,
            "error": str(e),
        }), 400

    except Exception:
        db.session.rollback()
        current_app.logger.exception("Could not load streak")
        return jsonify({  # type: ignore
            "success": False,
            "error": "Could not load streak"
        }), 500

@dashboard_bp.route("/api/dashboard", methods=["GET"])
@jwt_required()
def dashboard() -> tuple[Any, int]:
    """Return the authenticated user's period summary and trend data."""
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

        dashboard_data = get_dashboard_data(
            user_id=user_id,
            period=period,
            anchor_date=anchor_date,
            timezone=timezone,
        )

        return jsonify({  # type: ignore
            "success": True,
            **dashboard_data,
        }), 200

    except ValueError as e:
        return jsonify({  # type: ignore
            "success": False,
            "error": str(e),
        }), 400

    except Exception:
        db.session.rollback()
        current_app.logger.exception("Could not load dashboard")
        return jsonify({  # type: ignore
            "success": False,
            "error": "Could not load dashboard"
        }), 500
