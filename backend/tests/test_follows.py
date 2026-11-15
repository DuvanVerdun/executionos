from __future__ import annotations
from typing import Any

import pytest
from flask import Flask
from sqlalchemy import select, update

from executionos.extensions import db
from executionos.models import Block, Follow, User
from helpers import Account, body, call, make_account, request_without_token

AUTH_ROUTES = [
    pytest.param("PUT", "/api/users/lucia/follow", id="follow"),
    pytest.param("DELETE", "/api/users/lucia/follow", id="unfollow"),
    pytest.param("POST", "/api/follow-requests/lucia/accept", id="accept"),
    pytest.param("DELETE", "/api/follow-requests/lucia", id="decline"),
    pytest.param("GET", "/api/blocks", id="list blocks"),
    pytest.param("PUT", "/api/blocks/lucia", id="block"),
    pytest.param("DELETE", "/api/blocks/lucia", id="unblock"),
]

NOT_AVAILABLE = {"success": False, "error": "User not available"}


def make_private(who: Account) -> None:
    db.session.execute(update(User).where(User.id == who.user_id).values(is_private=True))
    db.session.commit()


def follows() -> list[tuple[int, int, str]]:
    rows = db.session.execute(select(Follow.follower_id, Follow.followee_id, Follow.status)).all()
    return [(follower, followee, status) for follower, followee, status in rows]


def blocked_usernames(who: Account) -> list[str]:
    blocked: list[dict[str, Any]] = body(call(who, "GET", "/api/blocks"))["blocked"]
    return [entry["username"] for entry in blocked]


@pytest.mark.parametrize("method, url", AUTH_ROUTES)
def test_every_route_needs_a_signed_in_user(app: Flask, method: str, url: str) -> None:
    assert request_without_token(app.test_client(), method, url).status_code == 401


def test_following_a_public_account_is_accepted_at_once(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")

    response = call(duvan, "PUT", "/api/users/lucia/follow")

    assert (response.status_code, body(response)["follow_status"]) == (200, "accepted")
    assert follows() == [(duvan.user_id, lucia.user_id, "accepted")]


def test_following_a_private_account_sends_a_request(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")
    make_private(lucia)

    response = call(duvan, "PUT", "/api/users/lucia/follow")

    assert body(response)["follow_status"] == "pending"
    assert follows() == [(duvan.user_id, lucia.user_id, "pending")]


def test_following_again_changes_nothing(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")
    make_private(lucia)
    call(duvan, "PUT", "/api/users/lucia/follow")

    response = call(duvan, "PUT", "/api/users/lucia/follow")

    assert body(response)["follow_status"] == "pending"
    assert len(follows()) == 1


def test_the_username_is_read_without_case_or_spaces(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    make_account(app, "lucia")

    assert call(duvan, "PUT", "/api/users/%20LUCIA%20/follow").status_code == 200


def test_unfollowing_removes_the_follow_and_can_be_repeated(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    make_account(app, "lucia")
    call(duvan, "PUT", "/api/users/lucia/follow")

    assert call(duvan, "DELETE", "/api/users/lucia/follow").status_code == 200
    assert call(duvan, "DELETE", "/api/users/lucia/follow").status_code == 200
    assert follows() == []


def test_unfollowing_takes_back_a_request(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    make_private(make_account(app, "lucia"))
    call(duvan, "PUT", "/api/users/lucia/follow")

    call(duvan, "DELETE", "/api/users/lucia/follow")

    assert follows() == []


def test_the_owner_accepts_a_request(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")
    make_private(lucia)
    call(duvan, "PUT", "/api/users/lucia/follow")

    assert call(lucia, "POST", "/api/follow-requests/duvan/accept").status_code == 200
    assert follows() == [(duvan.user_id, lucia.user_id, "accepted")]


def test_the_owner_declines_a_request(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")
    make_private(lucia)
    call(duvan, "PUT", "/api/users/lucia/follow")

    assert call(lucia, "DELETE", "/api/follow-requests/duvan").status_code == 200
    assert follows() == []


def test_the_requester_cannot_accept_their_own_request(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    make_private(make_account(app, "lucia"))
    call(duvan, "PUT", "/api/users/lucia/follow")

    response = call(duvan, "POST", "/api/follow-requests/lucia/accept")

    assert (response.status_code, body(response)) == (404, NOT_AVAILABLE)
    assert [status for _, _, status in follows()] == ["pending"]


@pytest.mark.parametrize("method, url", [
    pytest.param("POST", "/api/follow-requests/duvan/accept", id="accept"),
    pytest.param("DELETE", "/api/follow-requests/duvan", id="decline"),
])
def test_there_is_nothing_to_answer_without_a_pending_request(app: Flask, method: str, url: str) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")
    call(duvan, "PUT", "/api/users/lucia/follow")

    response = call(lucia, method, url)

    assert (response.status_code, body(response)) == (404, NOT_AVAILABLE)
    assert [status for _, _, status in follows()] == ["accepted"]


@pytest.mark.parametrize("method, url", [
    pytest.param("PUT", "/api/users/{name}/follow", id="follow"),
    pytest.param("DELETE", "/api/users/{name}/follow", id="unfollow"),
    pytest.param("POST", "/api/follow-requests/{name}/accept", id="accept"),
    pytest.param("DELETE", "/api/follow-requests/{name}", id="decline"),
    pytest.param("PUT", "/api/blocks/{name}", id="block"),
    pytest.param("DELETE", "/api/blocks/{name}", id="unblock"),
])
@pytest.mark.parametrize("name", ["nobody", "duvan"])
def test_a_missing_user_and_the_requester_look_the_same(app: Flask, method: str, url: str, name: str) -> None:
    duvan = make_account(app, "duvan")

    response = call(duvan, method, url.format(name=name))

    assert (response.status_code, body(response)) == (404, NOT_AVAILABLE)


def test_blocking_ends_the_follows_in_both_directions(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")
    mateo = make_account(app, "mateo")
    call(duvan, "PUT", "/api/users/lucia/follow")
    call(lucia, "PUT", "/api/users/duvan/follow")
    call(mateo, "PUT", "/api/users/duvan/follow")

    assert call(duvan, "PUT", "/api/blocks/lucia").status_code == 200
    assert follows() == [(mateo.user_id, duvan.user_id, "accepted")]


def test_a_block_hides_the_two_users_from_each_other(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")
    call(duvan, "PUT", "/api/blocks/lucia")

    for who, other in ((duvan, "lucia"), (lucia, "duvan")):
        response = call(who, "PUT", f"/api/users/{other}/follow")
        assert (response.status_code, body(response)) == (404, NOT_AVAILABLE)
    assert follows() == []


def test_blocking_twice_stores_one_block(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    make_account(app, "lucia")

    call(duvan, "PUT", "/api/blocks/lucia")
    call(duvan, "PUT", "/api/blocks/lucia")

    assert len(list(db.session.execute(select(Block.id)).scalars())) == 1


def test_unblocking_lets_them_find_each_other_again(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")
    call(duvan, "PUT", "/api/blocks/lucia")

    assert call(duvan, "DELETE", "/api/blocks/lucia").status_code == 200
    assert call(duvan, "DELETE", "/api/blocks/lucia").status_code == 200
    assert call(lucia, "PUT", "/api/users/duvan/follow").status_code == 200


def test_the_list_has_only_the_people_you_blocked_latest_first(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")
    make_account(app, "mateo")
    make_account(app, "noa")
    call(duvan, "PUT", "/api/blocks/mateo")
    call(duvan, "PUT", "/api/blocks/noa")

    assert blocked_usernames(duvan) == ["noa", "mateo"]
    assert blocked_usernames(lucia) == []
    call(duvan, "DELETE", "/api/blocks/noa")
    assert blocked_usernames(duvan) == ["mateo"]
