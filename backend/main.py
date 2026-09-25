from datetime import datetime, timedelta, UTC
from typing import Any, cast

from flask import Flask, request, jsonify  # type: ignore[attr-defined]
from flask_cors import CORS
from flask_migrate import Migrate

from sqlalchemy import select
from sqlalchemy.pool import NullPool
from werkzeug.wrappers import Response
from werkzeug.security import generate_password_hash, check_password_hash  # type: ignore[reportUnknownVariableType]
from flask_jwt_extended import create_access_token, create_refresh_token  # type: ignore[reportUnknownVariableType]
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt  # type: ignore[reportUnknownVariableType]

from extensions import db, jwt

import os
from dotenv import load_dotenv


load_dotenv()


def create_app() -> Flask:
    app = Flask(__name__)

    turso_url = os.environ["TURSO_DATABASE_URL"]
    db_uri = f"sqlite+{turso_url}?secure=true"
    app.config["SQLALCHEMY_DATABASE_URI"] = db_uri
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "connect_args": {"auth_token": os.environ["TURSO_AUTH_TOKEN"]},
        "poolclass": NullPool
    }
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)
    Migrate(app, db)
    CORS(app, supports_credentials=True, origins=["https://executionos-mvp.netlify.app", "http://localhost:5500"])

    app.config["JWT_SECRET_KEY"] = os.environ["JWT_SECRET_KEY"]
    app.config["JWT_TOKEN_LOCATION"] = ["headers", "cookies"]
    app.config["JWT_REFRESH_COOKIE_NAME"] = "refresh_token"
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False  # Disable CSRF protection for cookies
    jwt.init_app(app)

    from models import User  # noqa: F401

    @app.route("/api/register", methods=["POST"])
    def register() -> tuple[Any, int]:
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

            username_exists = db.session.execute(select(User.id).filter_by(username=normalized_username)).scalar_one_or_none()
            if username_exists is not None:
                return jsonify({  # type: ignore
                    "success": False,
                    "error": "username already registered"
                }), 409

            email_exists = db.session.execute(select(User.id).filter_by(email=normalized_email)).scalar_one_or_none()
            if email_exists is not None:
                return jsonify({  # type: ignore
                    "success": False,
                    "error": "email already registered"
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
        except Exception as e:
            db.session.rollback()
            return jsonify({  # type: ignore
                "success": False,
                "error": str(e)
            }), 400

    @app.route("/api/login", methods=["POST"])
    def login() -> tuple[Any, int]:
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
        except Exception as e:
            db.session.rollback()
            return jsonify({  # type: ignore
                "success": False,
                "error": str(e),
            }), 400

    @app.route("/api/refresh", methods=["POST"])
    @jwt_required(refresh=True)
    def refresh() -> tuple[Any, int]:
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
        except Exception as e:
            db.session.rollback()
            return jsonify({  # type: ignore
                "success": False,
                "error": str(e)
            }), 400

    @app.route("/api/logout", methods=["POST"])
    @jwt_required()
    def logout() -> tuple[Any, int]:
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
        except Exception as e:
            db.session.rollback()
            return jsonify({  # type: ignore
                "success": False,
                "error": str(e)
            }), 400

    from models import Session  # noqa: F401

    @app.route("/api/save-session", methods=["POST"])
    @jwt_required()
    def save_session() -> tuple[Any, int]:
        """Receive session data and save to the database."""
        try:
            data: dict[str, Any] = cast(dict[str, Any], request.json)  # type: ignore

            user_id = int(get_jwt_identity())

            new_session = Session(
                user_id=user_id,
                date=datetime.fromisoformat(data["date"].replace("Z", "+00:00")),
                mission=data["mission"],
                target_time_seconds=int(data["targetTimeSeconds"]),
                actual_time_seconds=int(data["actualTimeSeconds"])
            )

            db.session.add(new_session)
            db.session.commit()

            return jsonify({  # type: ignore
                "success": True,
                "message": "Session saved",
                "session_id": new_session.id
            }), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({  # type: ignore
                "success": False,
                "error": str(e)
            }), 400

    @app.route("/api/get-sessions", methods=["GET"])
    @jwt_required()
    def get_sessions() -> tuple[Any, int]:
        """Retrieve all sessions for a given user."""
        user_id = int(get_jwt_identity())
        sessions = db.session.execute(select(Session).filter_by(user_id=user_id)).scalars().all()

        sessions_list: list[dict[str, Any]] = [
            {
                "id": s.id,
                "date": s.date.isoformat(),
                "mission": s.mission,
                "target_time_seconds": s.target_time_seconds,
                "actual_time_seconds": s.actual_time_seconds,
                "percentage_completed": round(
                    s.actual_time_seconds / s.target_time_seconds * 100, 1
                    ) if s.target_time_seconds else 0,
                "completion_status": ("completed" if s.actual_time_seconds >= s.target_time_seconds else "partial")
            }
            for s in sessions
        ]

        return jsonify({  # type: ignore
            "success": True,
            "total_sessions": len(sessions_list),
            "sessions": sessions_list
        }), 200

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
        except Exception as e:
            db.session.rollback()
            return jsonify({  # type: ignore
                "success": False,
                "error": str(e)
            }), 400

    
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
        except Exception as e:
            db.session.rollback()
            return jsonify({  # type: ignore
                "success": False,
                "error": str(e)
            }), 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, ssl_context=("localhost+1.pem", "localhost+1-key.pem"))
