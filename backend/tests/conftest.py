from __future__ import annotations
import pytest
from executionos.extensions import db
from collections.abc import Generator
from flask import Flask
from flask.testing import FlaskClient
from flask.wrappers import Response

from helpers import make_test_app

@pytest.fixture
def app() -> Generator[Flask, None, None]:
    app = make_test_app()
    with app.app_context():
        db.create_all()
        yield app

@pytest.fixture
def client(app: Flask) -> FlaskClient[Response]:
    return app.test_client()
