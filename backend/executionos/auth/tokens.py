from datetime import UTC, datetime, timedelta
from typing import cast

from flask import jsonify  # type: ignore[attr-defined]
from flask_jwt_extended import create_access_token, create_refresh_token  # type: ignore[reportUnknownVariableType]
from werkzeug.wrappers import Response

from executionos.models import User

REFRESH_TOKEN_LIFETIME = timedelta(days=15)


def credentials_response(user: User, message: str, status: int) -> tuple[Response, int]:
    """Answer with fresh credentials: the access token in the body, the refresh token in a locked cookie."""
    expires_at = datetime.now(UTC) + REFRESH_TOKEN_LIFETIME

    access_token: str = create_access_token(identity=str(user.id))
    refresh_token: str = create_refresh_token(
        identity=str(user.id),
        additional_claims={"token_version": user.token_version},
        expires_delta=REFRESH_TOKEN_LIFETIME
    )

    response: Response = cast(Response, jsonify({
        "success": True,
        "message": message,
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
        expires=expires_at
    )

    return response, status
