from typing import Any

from flask import Blueprint, jsonify  # type: ignore[attr-defined]
from flask_jwt_extended import get_jwt_identity, jwt_required  # type: ignore[reportUnknownVariableType]

from executionos.account.errors import account_error_response
from executionos.account.service import (
    change_password_for_user,
    change_username_for_user,
    get_account_for_user,
    set_privacy_for_user,
)
from executionos.auth.tokens import credentials_response
from executionos.params import read_json_object

account_bp = Blueprint("account", __name__)


@account_bp.route("/api/account", methods=["GET"])
@jwt_required()
def get_account() -> tuple[Any, int]:
    """Return the settings of the authenticated user's account."""
    try:
        return jsonify({"success": True, "account": get_account_for_user(int(get_jwt_identity()))}), 200  # type: ignore
    except Exception as error:
        return account_error_response(error)


@account_bp.route("/api/account/username", methods=["PATCH"])
@jwt_required()
def change_username() -> tuple[Any, int]:
    """Change the username, at most once every 30 days."""
    try:
        data = read_json_object()
        account = change_username_for_user(int(get_jwt_identity()), data.get("username"))
        return jsonify({"success": True, "account": account}), 200  # type: ignore
    except Exception as error:
        return account_error_response(error)


@account_bp.route("/api/account/privacy", methods=["PATCH"])
@jwt_required()
def change_privacy() -> tuple[Any, int]:
    """Make the account public or private."""
    try:
        data = read_json_object()
        is_private = set_privacy_for_user(int(get_jwt_identity()), data.get("isPrivate"))
        return jsonify({"success": True, "is_private": is_private}), 200  # type: ignore
    except Exception as error:
        return account_error_response(error)


@account_bp.route("/api/account/password", methods=["PATCH"])
@jwt_required()
def change_password() -> tuple[Any, int]:
    """Change the password. The answer carries fresh credentials, so this session stays signed in."""
    try:
        data = read_json_object()
        user = change_password_for_user(int(get_jwt_identity()), data.get("currentPassword"), data.get("newPassword"))
        return credentials_response(user, "Password changed", 200)
    except Exception as error:
        return account_error_response(error)
