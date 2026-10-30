import os
from typing import Any

from dotenv import load_dotenv
from flask import Flask
from sqlalchemy.pool import NullPool


def configure(app: Flask, test_config: dict[str, Any] | None = None) -> None:
    """Fill app.config: the production settings come from the environment, tests pass their own."""
    if test_config is None:
        load_dotenv()
        turso_url = os.environ["TURSO_DATABASE_URL"]
        app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite+{turso_url}?secure=true"
        app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
            "connect_args": {"auth_token": os.environ["TURSO_AUTH_TOKEN"]},
            "poolclass": NullPool
        }
        app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

        app.config["JWT_SECRET_KEY"] = os.environ["JWT_SECRET_KEY"]
    else:
        app.config.update(test_config)

    app.config["JWT_TOKEN_LOCATION"] = ["headers", "cookies"]
    app.config["JWT_REFRESH_COOKIE_NAME"] = "refresh_token"
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
