from __future__ import annotations
import re
from flask import Flask
from flask.testing import FlaskClient
from flask.wrappers import Response
from sqlalchemy import select
from executionos.extensions import db
from executionos.models import User
from typing import cast

from helpers import (
    USER,
    body,
    get_refresh_cookie_value,
    login,
    logout,
    put_refresh_cookie,
    refresh,
    register,
    request_without_token,
    set_cookie_headers,
)

# The only routes that may answer without a token. Adding a public route is a deliberate decision.
PUBLIC_ENDPOINTS = {"auth.register", "auth.login", "static"}


def test_register_creates_account_and_normalizes_names(client: FlaskClient[Response]):
    result = register(client)
    assert result.status_code == 201
    assert body(result)["username"] == "duvan"
    assert body(result)["access_token"]


def test_register_never_stores_the_plain_password(client: FlaskClient[Response]):
    register(client)
    user = db.session.execute(select(User)).scalar_one()
    assert user.password_hash != USER["password"]


def test_register_sends_refresh_token_only_in_httponly_cookie(client: FlaskClient[Response]):
    result = register(client)
    cookie = next(c for c in set_cookie_headers(result) if c.startswith("refresh_token="))
    assert "HttpOnly" in cookie and "Secure" in cookie
    assert "refresh_token" not in body(result)


def test_login_accepts_username_or_email_in_any_case(client: FlaskClient[Response]):
    register(client)
    assert login(client, "DUVAN", USER["password"]).status_code == 200
    assert login(client, "duvan@example.com", USER["password"]).status_code == 200


def test_login_errors_do_not_reveal_whether_an_account_exists(client: FlaskClient[Response]):
    register(client)
    wrong_password = login(client, "duvan", "nope")
    unknown_user = login(client, "ghost", "nope")
    assert wrong_password.status_code == unknown_user.status_code == 401
    assert body(wrong_password) == body(unknown_user)


def test_refresh_with_valid_cookie_returns_new_access_token(client: FlaskClient[Response]):
    register(client)
    result = refresh(client)
    assert result.status_code == 200
    assert body(result)["access_token"]


def test_refresh_without_cookie_is_rejected(client: FlaskClient[Response]):
    assert refresh(client).status_code == 401


def test_logout_invalidates_the_old_refresh_token(client: FlaskClient[Response]):
    registered = register(client)
    old_cookie = get_refresh_cookie_value(client)
    token = body(registered)["access_token"]

    logout(client, token)
    put_refresh_cookie(client, old_cookie)

    result = refresh(client)
    assert result.status_code == 403


def test_register_duplicate_username_and_duplicate_email_get_the_same_answer(client: FlaskClient[Response]):
    register(client)
    same_username = register(client, email="other@example.com")
    same_email = register(client, username="other")
    assert same_username.status_code == same_email.status_code == 409
    assert body(same_username) == body(same_email)


def test_every_route_requires_login_unless_public(app: Flask):
    client = app.test_client()
    answered_without_login: list[str] = []

    for rule in app.url_map.iter_rules():
        if rule.endpoint in PUBLIC_ENDPOINTS:
            continue

        url = re.sub(r"<[^>]+>", "1", rule.rule)

        methods = cast(set[str], rule.methods or set())
        for method in methods - {"HEAD", "OPTIONS"}:
            status = request_without_token(client, method, url).status_code

            if status != 401:
                answered_without_login.append(f"{method} {rule.rule} answered {status}")

    assert answered_without_login == []
