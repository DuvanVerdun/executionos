from datetime import UTC, datetime
from typing import Any, cast

from flask import Blueprint, current_app, jsonify, request  # type: ignore[attr-defined]
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required  # type: ignore[reportUnknownVariableType]
from werkzeug.exceptions import HTTPException

from executionos.errors import error_response, server_error
from executionos.extensions import db
from executionos.models import Feedback

feedback_bp = Blueprint("feedback", __name__)


@feedback_bp.route("/api/feedback", methods=["POST"])
@jwt_required()
def feedback() -> tuple[Any, int]:
    """Receive a feedback message and save to the database."""
    try:
        data: dict[str, Any] = cast(dict[str, Any], request.json)  # type: ignore
        user_id = int(get_jwt_identity())


        if not isinstance(data, dict):  # type: ignore
            return error_response("JSON is not a object/dictionary", 400)

        raw_message = data.get("message")

        if not isinstance(raw_message, str):
            return error_response("Message is not a string", 400)
        
        message = raw_message.strip()
        
        if not message:
            return error_response("Message is empty", 400)

        if len(message) > 2000:
            return error_response("Message exceeds 2000 characters", 400)


        new_feedback = Feedback(
            user_id=user_id,
            message=message,
            created_at=datetime.now(UTC)
        )

        db.session.add(new_feedback)
        db.session.commit()

        return jsonify({  # type: ignore
            "success": True,
            "message": "Feedback submitted",
            "feedback_id": new_feedback.id
        }), 201
    except HTTPException:
        return error_response("Invalid request data", 400)
    except Exception:
        return server_error("Could not submit feedback")
