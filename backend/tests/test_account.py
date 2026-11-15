from __future__ import annotations
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from flask import Flask
from sqlalchemy import select, update

from executionos.extensions import db
from executionos.models import Follow, User
from helpers import (
    USER,
    Account,
    body,
    call,
    get_refresh_cookie_value,
    login,
    make_account,
    refresh,
    request_without_token,
)

NEW_PASSWORD = "Brand-new-pass-1"


def account_of(who: Account) -> dict[str, Any]:
    return body(call(who, "GET", "/api/account"))["account"]


def rename(who: Account, username: object) -> Any:
    return call(who, "PATCH", "/api/account/username", {"username": username})


def change_password(who: Account, current: object = USER["password"], new: object = NEW_PASSWORD) -> Any:
    return call(who, "PATCH", "/api/account/password", {"currentPassword": current, "newPassword": new})


def stored_user(who: Account) -> User:
    return db.session.execute(select(User).where(User.id == who.user_id)).scalar_one()


@pytest.mark.parametrize("method, url", [
    pytest.param("GET", "/api/account", id="read"),
    pytest.param("PATCH", "/api/account/username", id="username"),
    pytest.param("PATCH", "/api/account/privacy", id="privacy"),
    pytest.param("PATCH", "/api/account/password", id="password"),
])
def test_every_route_needs_a_signed_in_user(app: Flask, method: str, url: str) -> None:
    assert request_without_token(app.test_client(), method, url).status_code == 401


def test_a_new_account_is_public_and_can_change_its_username(app: Flask) -> None:
    duvan = make_account(app, "duvan")

    assert account_of(duvan) == {"username": "duvan", "is_private": False, "username_next_change_at": None}


def test_changing_the_username_stores_it_normalized_and_starts_the_wait(app: Flask) -> None:
    duvan = make_account(app, "duvan")

    response = rename(duvan, "  New.Name ")

    account = body(response)["account"]
    assert (response.status_code, account["username"]) == (200, "new.name")
    wait = datetime.fromisoformat(account["username_next_change_at"]).replace(tzinfo=UTC) - datetime.now(UTC)
    assert timedelta(days=29, hours=23) < wait <= timedelta(days=30)
    assert stored_user(duvan).username == "new.name"


def test_the_username_cannot_change_again_before_thirty_days(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    rename(duvan, "first")

    response = rename(duvan, "second")

    assert response.status_code == 409
    assert body(response)["next_change_at"] == account_of(duvan)["username_next_change_at"]
    assert stored_user(duvan).username == "first"


def test_the_username_can_change_again_after_thirty_days(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    rename(duvan, "first")
    db.session.execute(update(User).values(username_changed_at=datetime.now(UTC) - timedelta(days=31)))
    db.session.commit()

    assert rename(duvan, "second").status_code == 200
    assert stored_user(duvan).username == "second"


def test_sending_the_current_username_changes_nothing_and_starts_no_wait(app: Flask) -> None:
    duvan = make_account(app, "duvan")

    assert rename(duvan, "DUVAN").status_code == 200
    assert account_of(duvan)["username_next_change_at"] is None


def test_a_taken_username_is_refused_and_starts_no_wait(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    make_account(app, "lucia")

    response = rename(duvan, "Lucia")

    assert (response.status_code, body(response)["error"]) == (409, "Username already in use")
    assert account_of(duvan)["username_next_change_at"] is None


@pytest.mark.parametrize("username", ["", "   ", "x" * 51, None, 7])
def test_an_invalid_username_is_rejected(app: Flask, username: object) -> None:
    duvan = make_account(app, "duvan")

    assert rename(duvan, username).status_code == 400
    assert stored_user(duvan).username == "duvan"


def test_the_new_username_is_the_one_that_logs_in(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    rename(duvan, "renamed")
    client = app.test_client()

    assert login(client, "renamed", USER["password"]).status_code == 200
    assert login(client, "duvan", USER["password"]).status_code == 401


def test_the_account_can_become_private_and_public_again(app: Flask) -> None:
    duvan = make_account(app, "duvan")

    assert body(call(duvan, "PATCH", "/api/account/privacy", {"isPrivate": True})) == {"success": True, "is_private": True}
    assert account_of(duvan)["is_private"] is True
    call(duvan, "PATCH", "/api/account/privacy", {"isPrivate": False})
    assert account_of(duvan)["is_private"] is False


@pytest.mark.parametrize("value", [None, "true", 1, 0])
def test_privacy_must_be_a_boolean(app: Flask, value: object) -> None:
    duvan = make_account(app, "duvan")

    assert call(duvan, "PATCH", "/api/account/privacy", {"isPrivate": value}).status_code == 400
    assert account_of(duvan)["is_private"] is False


def test_becoming_public_accepts_the_waiting_requests_and_keeps_everything_else(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")
    mateo = make_account(app, "mateo")
    call(duvan, "PATCH", "/api/account/privacy", {"isPrivate": True})
    call(lucia, "PUT", "/api/users/duvan/follow")
    call(duvan, "PUT", "/api/users/mateo/follow")

    call(duvan, "PATCH", "/api/account/privacy", {"isPrivate": False})

    rows = db.session.execute(select(Follow.follower_id, Follow.followee_id, Follow.status)).all()
    assert sorted(tuple(row) for row in rows) == sorted([
        (lucia.user_id, duvan.user_id, "accepted"),
        (duvan.user_id, mateo.user_id, "accepted"),
    ])


def test_becoming_private_keeps_the_current_followers(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")
    call(lucia, "PUT", "/api/users/duvan/follow")

    call(duvan, "PATCH", "/api/account/privacy", {"isPrivate": True})

    assert db.session.execute(select(Follow.status)).scalars().all() == ["accepted"]
    assert body(call(lucia, "GET", "/api/users/duvan?timezone=UTC"))["profile"]["data"] is not None


def test_changing_the_password_keeps_this_session_and_ends_the_others(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    other_device = app.test_client()
    login(other_device, "duvan", USER["password"])
    old_cookie = get_refresh_cookie_value(duvan.client)

    response = change_password(duvan)

    data = body(response)
    assert (response.status_code, data["success"], data["username"]) == (200, True, "duvan")
    assert call(Account(duvan.client, data["access_token"], duvan.user_id, "duvan"), "GET", "/api/account").status_code == 200
    assert refresh(duvan.client).status_code == 200
    assert get_refresh_cookie_value(duvan.client) != old_cookie
    assert refresh(other_device).status_code == 403


def test_after_changing_the_password_only_the_new_one_logs_in(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    change_password(duvan)
    client = app.test_client()

    assert login(client, "duvan", USER["password"]).status_code == 401
    assert login(client, "duvan", NEW_PASSWORD).status_code == 200


def test_a_wrong_current_password_changes_nothing(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    old_hash = stored_user(duvan).password_hash

    response = change_password(duvan, current="not-the-password")

    assert (response.status_code, body(response)["error"]) == (403, "Current password is incorrect")
    assert (stored_user(duvan).password_hash, stored_user(duvan).token_version) == (old_hash, 0)


@pytest.mark.parametrize("new_password", [
    "Short-1!a",
    "no-uppercase-here-1!",
    "NO-LOWERCASE-HERE-1!",
    "No-digit-in-this-one!",
    "NoSymbolInThisOne123",
    12345678901234,
    None,
])
def test_a_weak_or_invalid_new_password_is_rejected(app: Flask, new_password: object) -> None:
    duvan = make_account(app, "duvan")

    assert change_password(duvan, new=new_password).status_code == 400
    assert stored_user(duvan).token_version == 0


def test_the_current_password_must_be_a_string(app: Flask) -> None:
    duvan = make_account(app, "duvan")

    assert change_password(duvan, current=None).status_code == 400
