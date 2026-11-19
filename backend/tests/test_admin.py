from __future__ import annotations
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from flask import Flask
from flask.testing import FlaskClient
from flask.wrappers import Response

from helpers import body, list_sessions, make_account, make_test_app, session_payload

ADMIN_KEY = "k" * 40


def admin_add(client: FlaskClient[Response], payload: dict[str, Any], key: str | None = ADMIN_KEY) -> Response:
    headers = {} if key is None else {"X-Admin-Key": key}
    return client.post("/api/admin/sessions", json=payload, headers=headers)  # type: ignore[reportUnknownMemberType]


@pytest.fixture
def admin_app(app: Flask) -> Flask:
    app.config["ADMIN_API_KEY"] = ADMIN_KEY
    return app


def test_the_admin_key_adds_a_session_to_the_users_history(admin_app: Flask):
    ana = make_account(admin_app, "ana")

    result = admin_add(admin_app.test_client(), {"username": " Ana ", **session_payload()})

    assert result.status_code == 201
    assert result.headers["Cache-Control"] == "no-store"
    assert [s["mission"] for s in list_sessions(ana)] == ["write tests"]


def test_a_repeated_submission_is_stored_once(admin_app: Flask):
    ana = make_account(admin_app, "ana")
    payload = {"username": "ana", **session_payload(submissionId="0b5d7a8e-6f4c-4d55-9d0a-2f3d6c1b7a10")}

    first = admin_add(admin_app.test_client(), payload)
    second = admin_add(admin_app.test_client(), payload)

    assert (first.status_code, second.status_code) == (201, 200)
    assert len(list_sessions(ana)) == 1


@pytest.mark.parametrize("key", [None, "", "wrong", "k" * 39, "k" * 41])
def test_a_missing_or_wrong_key_looks_like_a_route_that_does_not_exist(admin_app: Flask, key: str | None):
    ana = make_account(admin_app, "ana")

    result = admin_add(admin_app.test_client(), {"username": "ana", **session_payload()}, key)

    assert result.status_code == 404
    assert list_sessions(ana) == []


@pytest.mark.parametrize("configured", [None, "", "short-key"])
def test_the_route_is_off_without_a_long_enough_configured_key(configured: str | None):
    app = make_test_app()
    if configured is not None:
        app.config["ADMIN_API_KEY"] = configured

    result = admin_add(app.test_client(), {"username": "ana", **session_payload()}, configured or "")

    assert result.status_code == 404


def test_a_user_access_token_is_not_enough(admin_app: Flask):
    ana = make_account(admin_app, "ana")

    result = admin_app.test_client().post(  # type: ignore[reportUnknownMemberType]
        "/api/admin/sessions",
        json={"username": "ana", **session_payload()},
        headers={"Authorization": f"Bearer {ana.token}"},
    )

    assert result.status_code == 404


def test_an_unknown_user_is_not_found(admin_app: Flask):
    result = admin_add(admin_app.test_client(), {"username": "nobody", **session_payload()})

    assert result.status_code == 404
    assert body(result)["success"] is False


FUTURE = (datetime.now(UTC) + timedelta(days=1)).isoformat()


@pytest.mark.parametrize("overrides", [
    pytest.param({"date": FUTURE}, id="future date"),
    pytest.param({"actualTimeSeconds": -1}, id="negative time"),
    pytest.param({"mission": " "}, id="blank mission"),
    pytest.param({"username": None}, id="no username"),
])
def test_invalid_data_is_rejected_and_not_saved(admin_app: Flask, overrides: dict[str, Any]):
    ana = make_account(admin_app, "ana")

    result = admin_add(admin_app.test_client(), {"username": "ana", **session_payload(), **overrides})

    assert result.status_code == 400
    assert list_sessions(ana) == []


def test_a_big_body_is_refused(admin_app: Flask):
    ana = make_account(admin_app, "ana")

    result = admin_add(admin_app.test_client(), {"username": "ana", **session_payload(), "junk": "x" * 5000})

    assert result.status_code == 413
    assert list_sessions(ana) == []
