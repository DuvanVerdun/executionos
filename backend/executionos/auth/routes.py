from datetime import UTC, datetime, timedelta
from typing import Any, cast

from flask import Blueprint, current_app, jsonify, request  # type: ignore[attr-defined]
from flask_jwt_extended import create_access_token, create_refresh_token  # type: ignore[reportUnknownVariableType]
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required  # type: ignore[reportUnknownVariableType]
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash, generate_password_hash  # type: ignore[reportUnknownVariableType]
from werkzeug.wrappers import Response

from executionos.extensions import db
from executionos.models import User

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/api/register", methods=["POST"])
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
        current_app.logger.exception("Could not register")
        return jsonify({  # type: ignore
            "success": False,
            "error": "Could not register"
        }), 500

@auth_bp.route("/api/login", methods=["POST"])
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
        current_app.logger.exception("Could not log in")
        return jsonify({  # type: ignore
            "success": False,
            "error": "Could not log in"
        }), 500

@auth_bp.route("/api/refresh", methods=["POST"])
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
        current_app.logger.exception("Could not refresh session")
        return jsonify({  # type: ignore
            "success": False,
            "error": "Could not refresh session"
        }), 500

@auth_bp.route("/api/logout", methods=["POST"])
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
        current_app.logger.exception("Could not log out")
        return jsonify({  # type: ignore
            "success": False,
            "error": "Could not log out"
        }), 500
