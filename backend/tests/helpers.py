"""Shared helpers for the API tests. Every weak third-party type is hidden here, once."""
from __future__ import annotations
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, cast

from flask import Flask
from flask.testing import FlaskClient
from flask.wrappers import Response
from sqlalchemy.pool import StaticPool

from executionos.extensions import db
from main import create_app
from executionos.models import Session

USER = {"username": "Duvan", "email": "Duvan@Example.com", "password": "correct-horse-1"}
SESSION_DAY = datetime(2026, 10, 27, 12, 0, tzinfo=UTC)


def make_test_app() -> Flask:
    """An app on an empty in-memory database. It can never reach Turso."""
    return create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite://",
        "SQLALCHEMY_ENGINE_OPTIONS": {
            "poolclass": StaticPool,
            "connect_args": {"check_same_thread": False},
        },
        "JWT_SECRET_KEY": "a-long-test-secret-of-32-chars-or-more",
    })


# ---------- Auth, one request at a time ----------

def body(response: Response) -> dict[str, Any]:
    return cast(dict[str, Any], response.get_json())  # type: ignore[reportUnknownMemberType]


def register(client: FlaskClient[Response], **overrides: str) -> Response:
    return client.post("/api/register", json={**USER, **overrides})  # type: ignore[reportUnknownMemberType]


def login(client: FlaskClient[Response], who: str, password: str) -> Response:
    return client.post("/api/login", json={"usernameOrEmail": who, "password": password})  # type: ignore[reportUnknownMemberType]


def refresh(client: FlaskClient[Response]) -> Response:
    return client.post("/api/refresh", base_url="https://localhost")  # type: ignore[reportUnknownMemberType]


def logout(client: FlaskClient[Response], access_token: str) -> Response:
    return client.post("/api/logout", headers={"Authorization": f"Bearer {access_token}"})  # type: ignore[reportUnknownMemberType]


def set_cookie_headers(response: Response) -> list[str]:
    return response.headers.getlist("Set-Cookie")  # type: ignore[reportUnknownMemberType]


def get_refresh_cookie_value(client: FlaskClient[Response]) -> str:
    return client.get_cookie("refresh_token", path="/api/refresh").value  # type: ignore[reportUnknownMemberType]


def put_refresh_cookie(client: FlaskClient[Response], value: str) -> None:
    client.set_cookie("refresh_token", value, path="/api/refresh")  # type: ignore[reportUnknownMemberType]


def request_without_token(client: FlaskClient[Response], method: str, url: str) -> Response:
    return client.open(url, method=method, base_url="https://localhost")  # type: ignore[reportUnknownMemberType]


# ---------- People ----------

@dataclass(frozen=True)
class Account:
    """A registered user with their own browser (cookie jar) and access token."""
    client: FlaskClient[Response]
    token: str
    user_id: int
    username: str


def make_account(app: Flask, username: str) -> Account:
    client = app.test_client()
    data = body(register(client, username=username, email=f"{username}@example.com"))
    return Account(client, data["access_token"], data["user_id"], username)


def call(who: Account, method: str, url: str, payload: dict[str, Any] | None = None) -> Response:
    """Send a logged-in request as this account."""
    return who.client.open(  # type: ignore[reportUnknownMemberType]
        url,
        method=method,
        json=payload,
        headers={"Authorization": f"Bearer {who.token}"},
        base_url="https://localhost",
    )


# ---------- Personal sessions ----------

def session_payload(**overrides: Any) -> dict[str, Any]:
    return {
        "mission": "write tests",
        "targetTimeSeconds": 3600,
        "actualTimeSeconds": 1800,
        "date": "2026-10-27T12:00:00Z",
        **overrides,
    }


def save_session(who: Account, **overrides: Any) -> Response:
    return call(who, "POST", "/api/save-session", session_payload(**overrides))


def list_sessions(who: Account) -> list[dict[str, Any]]:
    """Every session of this user, up to the first page."""
    today = datetime.now(UTC).date().isoformat()
    result = call(who, "GET", f"/api/get-sessions?period=all_time&anchor_date={today}&timezone=UTC")
    return cast(list[dict[str, Any]], body(result)["sessions"])


def dashboard(who: Account, period: str, anchor_date: str, timezone: str) -> dict[str, Any]:
    return body(call(who, "GET", f"/api/dashboard?period={period}&anchor_date={anchor_date}&timezone={timezone}"))


def seed_session(
    user_id: int,
    when: datetime,
    actual_seconds: int,
    *,
    target_seconds: int = 3600,
    mission: str = "seeded",
    room_id: int | None = None,
) -> None:
    """Write a session straight into the database. Only the server creates room sessions."""
    session = Session(
        user_id=user_id,
        date=when,
        mission=mission,
        target_time_seconds=target_seconds,
        actual_time_seconds=actual_seconds,
    )
    session.room_id = room_id
    db.session.add(session)
    db.session.commit()


# ---------- Rooms ----------

def create_room(who: Account, name: str = "Deep work") -> dict[str, Any]:
    return cast(dict[str, Any], body(call(who, "POST", "/api/rooms", {"name": name}))["room"])


def join_room(who: Account, room: dict[str, Any]) -> Response:
    return call(who, "POST", "/api/rooms/join", {"linkToken": room["link_token"]})


def start_room_session(who: Account, room_id: int, mission: str = "write tests") -> Response:
    return call(who, "POST", "/api/room-session", {"roomId": room_id, "mission": mission, "targetTimeSeconds": 3600})
