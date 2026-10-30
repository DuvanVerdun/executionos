from __future__ import annotations
from typing import Any
import pytest
from flask.testing import FlaskClient
from flask.wrappers import Response
from sqlalchemy.orm import Session

from helpers import body, register

SECRET = "SECRET-INTERNAL-DETAIL"

ROUTES: list[tuple[str, str, dict[str, str] | None]] = [
    ("post", "/api/register", {"username": "other", "email": "other@example.com", "password": "pw"}),
    ("post", "/api/login", {"usernameOrEmail": "owner", "password": "pw"}),
    ("post", "/api/refresh", None),
    ("post", "/api/logout", None),
    ("get", "/api/streak?anchor_date=2026-01-01&timezone=UTC", None),
    ("get", "/api/dashboard?period=week&anchor_date=2026-01-01&timezone=UTC", None),
    ("get", "/api/get-sessions?period=week&anchor_date=2026-01-01&timezone=UTC", None),
    ("delete", "/api/delete-session/1", None),
    ("post", "/api/feedback", {"message": "hello"}),
]


def send(client: FlaskClient[Response], method: str, url: str, payload: dict[str, str] | None, token: str) -> Response:
    # Refresh reads the cookie. An access token in the header would be rejected before the route runs.
    headers = {} if url == "/api/refresh" else {"Authorization": f"Bearer {token}"}
    return client.open(  # type: ignore[reportUnknownMemberType]
        url,
        method=method,
        json=payload,
        headers=headers,
        base_url="https://localhost",
    )


@pytest.mark.parametrize("method, url, payload", ROUTES, ids=[f"{m} {u.split('?')[0]}" for m, u, _ in ROUTES])
def test_unexpected_failure_returns_generic_500(
    client: FlaskClient[Response],
    monkeypatch: pytest.MonkeyPatch,
    method: str,
    url: str,
    payload: dict[str, str] | None,
):
    token = body(register(client, username="owner", email="owner@example.com"))["access_token"]

    def explode(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError(SECRET)

    monkeypatch.setattr(Session, "execute", explode)
    monkeypatch.setattr(Session, "commit", explode)

    result = send(client, method, url, payload, token)

    assert SECRET not in result.get_data(as_text=True)  # type: ignore[reportUnknownMemberType]
    assert result.status_code == 500


BAD_INPUT: list[tuple[str, str, dict[str, str] | None]] = [
    ("post", "/api/register", None),
    ("post", "/api/register", {}),
    ("post", "/api/login", None),
    ("post", "/api/login", {}),
    ("post", "/api/feedback", None),
]


@pytest.mark.parametrize("method, url, payload", BAD_INPUT, ids=[f"{m} {u} {p!r}" for m, u, p in BAD_INPUT])
def test_bad_input_returns_generic_400(
    client: FlaskClient[Response],
    method: str,
    url: str,
    payload: dict[str, str] | None,
):
    token = body(register(client, username="owner", email="owner@example.com"))["access_token"]

    result = send(client, method, url, payload, token)

    assert result.status_code == 400
    assert body(result)["success"] is False
