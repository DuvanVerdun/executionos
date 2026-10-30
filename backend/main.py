from datetime import datetime, timedelta, UTC
from collections.abc import Callable
from typing import Any, cast
from uuid import UUID

from flask import Flask, request, jsonify  # type: ignore[attr-defined]
from flask_cors import CORS
from flask_migrate import Migrate

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.pool import NullPool
from werkzeug.exceptions import HTTPException
from werkzeug.wrappers import Response
from werkzeug.security import generate_password_hash, check_password_hash  # type: ignore[reportUnknownVariableType]
from flask_jwt_extended import create_access_token, create_refresh_token  # type: ignore[reportUnknownVariableType]
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt  # type: ignore[reportUnknownVariableType]

from extensions import db, jwt

import os
from dotenv import load_dotenv


load_dotenv()


def create_app(test_config: dict[str, Any] | None = None) -> Flask:
    """Create and configure the Flask application and its API routes."""
    app = Flask(__name__)

    if test_config is None:
        turso_url = os.environ["TURSO_DATABASE_URL"]
        db_uri = f"sqlite+{turso_url}?secure=true"
        app.config["SQLALCHEMY_DATABASE_URI"] = db_uri
        app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
            "connect_args": {"auth_token": os.environ["TURSO_AUTH_TOKEN"]},
            "poolclass": NullPool
        }
        app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

        app.config["JWT_SECRET_KEY"] = os.environ["JWT_SECRET_KEY"]
    else:
        app.config.update(test_config)

    db.init_app(app)
    Migrate(app, db)
    CORS(app, supports_credentials=True, origins=["https://executionos-mvp.netlify.app", "http://localhost:5500"])

    app.config["JWT_TOKEN_LOCATION"] = ["headers", "cookies"]
    app.config["JWT_REFRESH_COOKIE_NAME"] = "refresh_token"
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    jwt.init_app(app)

    from models import User  # noqa: F401

    @app.route("/api/register", methods=["POST"])
    def register() -> tuple[Any, int]:
        """Create an account and issue access and refresh credentials."""
        try:
            data: dict[str, Any] = cast(dict[str, Any], request.get_json())  # type: ignore

            username = data["username"]
            email = data["email"]
            password = data["password"]

            if not isinstance(username, str):
                return jsonify({  # type: ignore
                    "success": False,
                    "error": "username is not a string"
                }), 400
            if not isinstance(email, str):
                return jsonify({  # type: ignore
                    "success": False,
                    "error": "email is not a string"
                }), 400
            if not isinstance(password, str):
                return jsonify({  # type: ignore
                    "success": False,
                    "error": "password is not a string"
                }), 400
                        

            normalized_username = username.strip().lower()
            normalized_email = email.strip().lower()

            if not normalized_username or not normalized_email:
                return jsonify({  #type: ignore
                    "success": False,
                    "error": "Username and email are required"
                }), 400

            if len(normalized_username) > 50:
                return jsonify({  # type: ignore
                    "success": False,
                    "error": "Username too long. Expected 50 characters or less"
                }), 400
            if len(normalized_email) > 120:
                return jsonify({  # type: ignore
                    "success": False,
                    "error": "Email too long. Expected 120 characters or less"
                }), 400

            account_exists = db.session.execute(
                select(User.id).where(or_(User.username == normalized_username, User.email == normalized_email))
            ).first()
            if account_exists is not None:
                return jsonify({  # type: ignore
                    "success": False,
                    "error": "Username or email already registered"
                }), 409

            new_user = User(
                username=normalized_username,
                email=normalized_email,
                password_hash=cast(str, generate_password_hash(password))
            )

            db.session.add(new_user)
            db.session.commit()

            duration_expire_time = timedelta(days=15)
            absolute_expire_time = datetime.now(UTC) + duration_expire_time

            access_token: str = create_access_token(identity=str(new_user.id))
            refresh_token: str = create_refresh_token(
                identity=str(new_user.id),
                additional_claims={"token_version": new_user.token_version},
                expires_delta=duration_expire_time
            )

            response: Response = cast(Response, jsonify({
                "success": True,
                "message": "User registered",
                "user_id": new_user.id,
                "access_token": access_token,
                "username": new_user.username
            }))

            response.set_cookie(
                "refresh_token",
                refresh_token,
                secure=True,
                samesite="None",
                path="/api/refresh",
                httponly=True,
                expires=absolute_expire_time
            )
            return response, 201
        except (KeyError, TypeError, HTTPException):
            return jsonify({  # type: ignore
                "success": False,
                "error": "Invalid request data"
            }), 400
        except IntegrityError:
            db.session.rollback()
            return jsonify({  # type: ignore
                "success": False,
                "error": "Username or email already registered"
            }), 409
        except Exception:
            db.session.rollback()
            app.logger.exception("Could not register")
            return jsonify({  # type: ignore
                "success": False,
                "error": "Could not register"
            }), 500

    @app.route("/api/login", methods=["POST"])
    def login() -> tuple[Any, int]:
        """Authenticate credentials and issue access and refresh credentials."""
        try:
            data: dict[str, Any] = cast(dict[str, Any], request.get_json())  # type: ignore

            if not isinstance(data["usernameOrEmail"], str):
                return jsonify({  # type: ignore
                    "success": False,
                    "error": "username or email is not a string"
                }), 400
            if not isinstance(data["password"], str):
                return jsonify({  # type: ignore
                    "success": False,
                    "error": "password is not a string"
                }), 400
            
            normalized_username_or_email = data["usernameOrEmail"].strip().lower()
            if "@" in normalized_username_or_email:
                user = db.session.execute(select(User).filter_by(email=normalized_username_or_email)).scalar_one_or_none()
            else:
                user = db.session.execute(select(User).filter_by(username=normalized_username_or_email)).scalar_one_or_none()

            if user is None or not cast(bool, check_password_hash(user.password_hash, data["password"])):
                return jsonify({  # type: ignore
                    "success": False,
                    "error": "Invalid username/email or password"
                }), 401

            duration_expire_time = timedelta(days=15)
            absolute_expire_time = datetime.now(UTC) + duration_expire_time

            access_token: str = create_access_token(identity=str(user.id))
            refresh_token: str = create_refresh_token(
                    identity=str(user.id),
                    additional_claims={"token_version": user.token_version},
                    expires_delta=duration_expire_time
                )

            response: Response = cast(Response, jsonify({
                "success": True,
                "message": "Login successful",
                "user_id": user.id,
                "access_token": access_token,
                "username": user.username
            }))

            response.set_cookie(
                "refresh_token",
                refresh_token,
                secure=True,
                samesite="None",
                path="/api/refresh",
                httponly=True,
                expires=absolute_expire_time
            )

            return response, 200
        except (KeyError, TypeError, HTTPException):
            return jsonify({  # type: ignore
                "success": False,
                "error": "Invalid request data"
            }), 400
        except Exception:
            db.session.rollback()
            app.logger.exception("Could not log in")
            return jsonify({  # type: ignore
                "success": False,
                "error": "Could not log in"
            }), 500

    @app.route("/api/refresh", methods=["POST"])
    @jwt_required(refresh=True)
    def refresh() -> tuple[Any, int]:
        """Validate the refresh session and renew authentication credentials."""
        try:
            user_id = get_jwt_identity()
            claims: dict[str, Any] = cast(dict[str, Any], get_jwt())
            token_version_from_refresh: int = cast(int, claims["token_version"])

            user = db.session.execute(select(User).filter_by(id=int(user_id))).scalar_one_or_none()
            if user is None:
                return jsonify({  # type: ignore
                    "success": False,
                    "error": "User not found"
                }), 404

            if token_version_from_refresh != user.token_version:
                return jsonify({  # type: ignore
                    "success": False,
                    "error": "Token version mismatch"
                }), 403

            duration_expire_time = timedelta(days=15)
            absolute_expire_time = datetime.now(UTC) + duration_expire_time

            access_token: str = create_access_token(identity=str(user.id))
            refresh_token: str = create_refresh_token(
                identity=str(user.id),
                additional_claims={"token_version": user.token_version},
                expires_delta=duration_expire_time
            )

            response: Response = cast(Response, jsonify({
                "success": True,
                "message": "Access token refreshed",
                "user_id": user.id,
                "access_token": access_token,
                "username": user.username
            }))

            response.set_cookie(
                "refresh_token",
                refresh_token,
                secure=True,
                samesite="None",
                path="/api/refresh",
                httponly=True,
                expires=absolute_expire_time
            )

            return response, 200
        except Exception:
            db.session.rollback()
            app.logger.exception("Could not refresh session")
            return jsonify({  # type: ignore
                "success": False,
                "error": "Could not refresh session"
            }), 500

    @app.route("/api/logout", methods=["POST"])
    @jwt_required()
    def logout() -> tuple[Any, int]:
        """Invalidate refresh sessions and clear the refresh cookie."""
        try:
            user_id = get_jwt_identity()
            user = db.session.execute(select(User).filter_by(id=int(user_id))).scalar_one_or_none()
            if user is None:
                return jsonify({  # type: ignore
                    "success": False,
                    "error": "User not found"
                }), 404

            user.token_version += 1
            db.session.commit()

            response: Response = cast(Response, jsonify({
                "success": True,
                "message": "User logged out and token version incremented"
            }))

            response.delete_cookie(  # type: ignore[reportUnknownMemberType]
                "refresh_token",
                path="/api/refresh"
            )

            return response, 200
        except Exception:
            db.session.rollback()
            app.logger.exception("Could not log out")
            return jsonify({  # type: ignore
                "success": False,
                "error": "Could not log out"
            }), 500

    from models import Session  # noqa: F401

    from dashboard_service import (
        get_dashboard_data,
        get_paginated_sessions,
        get_streak_data,
        parse_anchor_date,
        parse_cursor_datetime,
        parse_period,
        parse_timezone
    )

    from room_session_service import (
        RoomSessionConflictError,
        checkin_room_session_for_user,
        finalize_overdue_for_rooms,
        finalize_overdue_for_user_rooms,
        finalize_overdue_for_users,
        finish_room_session_for_user,
        get_room_session_for_user,
        heartbeat_room_session_for_user,
        pause_room_session_for_user,
        resume_room_session_for_user,
        start_room_session_for_user,
    )

    def finalize_quietly(finalize: Callable[[], None]) -> None:
        """Finalize overdue room sessions on a read path. A failure is logged, never raised."""
        try:
            finalize()
        except Exception:
            db.session.rollback()
            app.logger.exception("Could not finalize overdue room sessions")

    @app.route("/api/streak", methods=["GET"])
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
            app.logger.exception("Could not load streak")
            return jsonify({  # type: ignore
                "success": False,
                "error": "Could not load streak"
            }), 500

    @app.route("/api/dashboard", methods=["GET"])
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
            app.logger.exception("Could not load dashboard")
            return jsonify({  # type: ignore
                "success": False,
                "error": "Could not load dashboard"
            }), 500

    @app.route("/api/get-sessions", methods=["GET"])
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

            raw_cursor_date = request.args.get("cursor_date")
            raw_cursor_id = request.args.get("cursor_id")

            if (raw_cursor_date is None) != (raw_cursor_id is None):
                return jsonify({  # type: ignore
                    "success": False,
                    "error": (
                        "cursor_date and cursor_id must be "
                        "provided together"
                    ),
                }), 400

            cursor_date: datetime | None = None
            cursor_id: int | None = None

            if raw_cursor_date is not None and raw_cursor_id is not None:
                cursor_date = parse_cursor_datetime(
                    raw_cursor_date
                )
                cursor_id = int(raw_cursor_id)

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
            return jsonify({  # type: ignore
                "success": False,
                "error": str(e),
            }), 400

        except Exception:
            db.session.rollback()
            app.logger.exception("Could not load sessions")
            return jsonify({  # type: ignore
                "success": False,
                "error": "Could not load sessions"
            }), 500

    @app.route("/api/save-session", methods=["POST"])
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
            return jsonify({"success": False, "error": "Invalid session data"}), 400  # type: ignore
        except IntegrityError:
            db.session.rollback()

            if submission_id is not None:
                existing = db.session.execute(select(Session).filter_by(
                    user_id=user_id, submission_id=submission_id
                )).scalar_one_or_none()
                if existing is not None:
                    return jsonify({"success": True, "session_id": existing.id}), 200  # type: ignore
            app.logger.exception("Could not save session")
            return jsonify({"success": False, "error": "Could not save session"}), 500  # type: ignore
        except Exception:
            db.session.rollback()
            app.logger.exception("Could not save session")
            return jsonify({"success": False, "error": "Could not save session"}), 500  # type: ignore

    @app.route("/api/delete-session/<int:session_id>", methods=["DELETE"])
    @jwt_required()
    def delete_session(session_id: int) -> tuple[Any, int]:
        """Delete a session, but only if it belongs to the requesting user."""
        try:
            user_id = int(get_jwt_identity())

            session = db.session.execute(select(Session).filter_by(id=session_id, user_id=user_id)).scalar_one_or_none()

            if session is None:
                return jsonify({  # type: ignore
                    "success": False,
                    "error": "Session not found"
                }), 404

            db.session.delete(session)
            db.session.commit()

            return jsonify({  # type: ignore
                "success": True,
                "message": "Session deleted",
                "session_id": session_id
            }), 200
        except Exception:
            db.session.rollback()
            app.logger.exception("Could not delete session")
            return jsonify({  # type: ignore
                "success": False,
                "error": "Could not delete session"
            }), 500

    
    from models import Feedback  # noqa: F401

    @app.route("/api/feedback", methods=["POST"])
    @jwt_required()
    def feedback() -> tuple[Any, int]:
        """Receive a feedback message and save to the database."""
        try:
            data: dict[str, Any] = cast(dict[str, Any], request.json)  # type: ignore
            user_id = int(get_jwt_identity())


            if not isinstance(data, dict):  # type: ignore
                return jsonify({  # type: ignore
                    "success": False,
                    "error": "JSON is not a object/dictionary"
                }), 400

            raw_message = data.get("message")

            if not isinstance(raw_message, str):
                return jsonify({  # type: ignore
                    "success": False,
                    "error": "Message is not a string"
                }), 400
            
            message = raw_message.strip()
            
            if not message:
                return jsonify({  # type: ignore
                    "success": False,
                    "error": "Message is empty"
                }), 400

            if len(message) > 2000:
                return jsonify({  # type: ignore
                    "success": False,
                    "error": "Message exceeds 2000 characters"
                }), 400


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
            return jsonify({  # type: ignore
                "success": False,
                "error": "Invalid request data"
            }), 400
        except Exception:
            db.session.rollback()
            app.logger.exception("Could not submit feedback")
            return jsonify({  # type: ignore
                "success": False,
                "error": "Could not submit feedback"
            }), 500

    from room_service import (
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

        app.logger.error("Room request failed", exc_info=error)
        return jsonify({"success": False, "error": "Room request failed"}), 500  # type: ignore

    @app.route("/api/rooms", methods=["GET"])
    @jwt_required()
    def get_rooms() -> tuple[Any, int]:
        """Return the rooms the authenticated user belongs to."""
        user_id = int(get_jwt_identity())
        try:
            finalize_quietly(lambda: finalize_overdue_for_user_rooms(user_id))
            return jsonify({"success": True, "rooms": list_rooms_for_user(user_id)}), 200  # type: ignore
        except Exception as error:
            return room_error_response(error)

    @app.route("/api/rooms", methods=["POST"])
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

    @app.route("/api/rooms/join", methods=["POST"])
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

    @app.route("/api/rooms/<int:room_id>/leave", methods=["POST"])
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

    @app.route("/api/rooms/<int:room_id>", methods=["DELETE"])
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

    @app.route("/api/rooms/<int:room_id>/link", methods=["GET"])
    @jwt_required()
    def get_room_link(room_id: int) -> tuple[Any, int]:
        """Return the room link token. Owner only."""
        user_id = int(get_jwt_identity())
        try:
            token = get_room_link_for_user(user_id, room_id)
            return jsonify({"success": True, "link_token": token}), 200  # type: ignore
        except Exception as error:
            return room_error_response(error)

    @app.route("/api/rooms/<int:room_id>/link/refresh", methods=["POST"])
    @jwt_required()
    def refresh_room_link(room_id: int) -> tuple[Any, int]:
        """Replace the room link token. Owner only."""
        user_id = int(get_jwt_identity())
        try:
            token = refresh_room_link_for_user(user_id, room_id)
            return jsonify({"success": True, "link_token": token}), 200  # type: ignore
        except Exception as error:
            return room_error_response(error)

    @app.route("/api/rooms/<int:room_id>/membership", methods=["PATCH"])
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

    @app.route("/api/rooms/<int:room_id>", methods=["GET"])
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

    @app.route("/api/rooms/<int:room_id>/summary", methods=["GET"])
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

    @app.route("/api/rooms/<int:room_id>/sessions", methods=["GET"])
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

    @app.route("/api/room-session", methods=["GET"])
    @jwt_required()
    def get_room_session() -> tuple[Any, int]:
        """Return the authenticated user's running room session, if any."""
        user_id = int(get_jwt_identity())
        try:
            return jsonify(get_room_session_for_user(user_id)), 200  # type: ignore
        except Exception as error:
            return room_error_response(error)

    @app.route("/api/room-session", methods=["POST"])
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

    @app.route("/api/room-session/pause", methods=["POST"])
    @jwt_required()
    def pause_room_session() -> tuple[Any, int]:
        """Pause the running room session. Stop uses the same transition."""
        user_id = int(get_jwt_identity())
        try:
            return jsonify(pause_room_session_for_user(user_id)), 200  # type: ignore
        except Exception as error:
            return room_error_response(error)

    @app.route("/api/room-session/resume", methods=["POST"])
    @jwt_required()
    def resume_room_session() -> tuple[Any, int]:
        """Resume the paused room session. Continue uses the same transition."""
        user_id = int(get_jwt_identity())
        try:
            return jsonify(resume_room_session_for_user(user_id)), 200  # type: ignore
        except Exception as error:
            return room_error_response(error)

    @app.route("/api/room-session/checkin", methods=["POST"])
    @jwt_required()
    def checkin_room_session() -> tuple[Any, int]:
        """Confirm presence for the outstanding check-in."""
        user_id = int(get_jwt_identity())
        try:
            return jsonify(checkin_room_session_for_user(user_id)), 200  # type: ignore
        except Exception as error:
            return room_error_response(error)

    @app.route("/api/room-session/heartbeat", methods=["POST"])
    @jwt_required()
    def heartbeat_room_session() -> tuple[Any, int]:
        """Tell the server the client is alive."""
        user_id = int(get_jwt_identity())
        try:
            return jsonify(heartbeat_room_session_for_user(user_id)), 200  # type: ignore
        except Exception as error:
            return room_error_response(error)

    @app.route("/api/room-session/finish", methods=["POST"])
    @jwt_required()
    def finish_room_session() -> tuple[Any, int]:
        """Save the paused room session and end it."""
        user_id = int(get_jwt_identity())
        try:
            data = read_json_object()
            return jsonify(finish_room_session_for_user(user_id, data.get("submissionId"))), 200  # type: ignore
        except Exception as error:
            return room_error_response(error)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, ssl_context=("localhost+1.pem", "localhost+1-key.pem"))
