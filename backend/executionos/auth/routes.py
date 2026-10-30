from typing import Any, cast

from flask import Blueprint, current_app, jsonify, request  # type: ignore[attr-defined]
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required  # type: ignore[reportUnknownVariableType]
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash, generate_password_hash  # type: ignore[reportUnknownVariableType]
from werkzeug.wrappers import Response

from executionos.auth.tokens import credentials_response
from executionos.errors import error_response, server_error
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
            return error_response("username is not a string", 400)
        if not isinstance(email, str):
            return error_response("email is not a string", 400)
        if not isinstance(password, str):
            return error_response("password is not a string", 400)
                    

        normalized_username = username.strip().lower()
        normalized_email = email.strip().lower()

        if not normalized_username or not normalized_email:
            return error_response("Username and email are required", 400)

        if len(normalized_username) > 50:
            return error_response("Username too long. Expected 50 characters or less", 400)
        if len(normalized_email) > 120:
            return error_response("Email too long. Expected 120 characters or less", 400)

        account_exists = db.session.execute(
            select(User.id).where(or_(User.username == normalized_username, User.email == normalized_email))
        ).first()
        if account_exists is not None:
            return error_response("Username or email already registered", 409)

        new_user = User(
            username=normalized_username,
            email=normalized_email,
            password_hash=cast(str, generate_password_hash(password))
        )

        db.session.add(new_user)
        db.session.commit()

        return credentials_response(new_user, "User registered", 201)
    except (KeyError, TypeError, HTTPException):
        return error_response("Invalid request data", 400)
    except IntegrityError:
        db.session.rollback()
        return error_response("Username or email already registered", 409)
    except Exception:
        return server_error("Could not register")

@auth_bp.route("/api/login", methods=["POST"])
def login() -> tuple[Any, int]:
    """Authenticate credentials and issue access and refresh credentials."""
    try:
        data: dict[str, Any] = cast(dict[str, Any], request.get_json())  # type: ignore

        if not isinstance(data["usernameOrEmail"], str):
            return error_response("username or email is not a string", 400)
        if not isinstance(data["password"], str):
            return error_response("password is not a string", 400)
        
        normalized_username_or_email = data["usernameOrEmail"].strip().lower()
        if "@" in normalized_username_or_email:
            user = db.session.execute(select(User).filter_by(email=normalized_username_or_email)).scalar_one_or_none()
        else:
            user = db.session.execute(select(User).filter_by(username=normalized_username_or_email)).scalar_one_or_none()

        if user is None or not cast(bool, check_password_hash(user.password_hash, data["password"])):
            return error_response("Invalid username/email or password", 401)

        return credentials_response(user, "Login successful", 200)
    except (KeyError, TypeError, HTTPException):
        return error_response("Invalid request data", 400)
    except Exception:
        return server_error("Could not log in")

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
            return error_response("User not found", 404)

        if token_version_from_refresh != user.token_version:
            return error_response("Token version mismatch", 403)

        return credentials_response(user, "Access token refreshed", 200)
    except Exception:
        return server_error("Could not refresh session")

@auth_bp.route("/api/logout", methods=["POST"])
@jwt_required()
def logout() -> tuple[Any, int]:
    """Invalidate refresh sessions and clear the refresh cookie."""
    try:
        user_id = get_jwt_identity()
        user = db.session.execute(select(User).filter_by(id=int(user_id))).scalar_one_or_none()
        if user is None:
            return error_response("User not found", 404)

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
        return server_error("Could not log out")
