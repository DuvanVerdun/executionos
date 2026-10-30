from __future__ import annotations
from typing import Any

from datetime import timedelta

import pytest
from flask import Flask
from sqlalchemy import select

from executionos.extensions import db
from helpers import (
    SESSION_DAY,
    body,
    call,
    create_room,
    join_room,
    all_pages,
    list_sessions,
    make_account,
    seed_session,
)
from executionos.models import Session

# method, url, payload. {room_id} is filled in by the test.
ROOM_ROUTES = [
    pytest.param("GET", "/api/rooms/{room_id}", None, id="snapshot"),
    pytest.param("GET", "/api/rooms/{room_id}/summary", None, id="summary"),
    pytest.param("GET", "/api/rooms/{room_id}/sessions?timezone=UTC", None, id="history"),
    pytest.param("GET", "/api/rooms/{room_id}/link", None, id="read link"),
    pytest.param("POST", "/api/rooms/{room_id}/link/refresh", None, id="refresh link"),
    pytest.param("PATCH", "/api/rooms/{room_id}/membership", {"showMissions": True}, id="change membership"),
    pytest.param("POST", "/api/rooms/{room_id}/leave", None, id="leave"),
    pytest.param("DELETE", "/api/rooms/{room_id}", None, id="delete"),
]

OWNER_ONLY_ROUTES = [
    pytest.param("GET", "/api/rooms/{room_id}/link", id="read link"),
    pytest.param("POST", "/api/rooms/{room_id}/link/refresh", id="refresh link"),
    pytest.param("DELETE", "/api/rooms/{room_id}", id="delete"),
]


@pytest.mark.parametrize("method, url, payload", ROOM_ROUTES)
def test_a_non_member_gets_the_same_404_as_for_a_room_that_does_not_exist(
    app: Flask,
    method: str,
    url: str,
    payload: dict[str, Any] | None,
):
    ana = make_account(app, "ana")
    bob = make_account(app, "bob")
    room = create_room(ana)

    private_room = call(bob, method, url.format(room_id=room["id"]), payload)
    missing_room = call(bob, method, url.format(room_id=999999), payload)

    assert private_room.status_code == missing_room.status_code == 404
    assert body(private_room) == body(missing_room)


@pytest.mark.parametrize("method, url", OWNER_ONLY_ROUTES)
def test_a_member_who_is_not_the_owner_gets_403_on_owner_actions(app: Flask, method: str, url: str):
    ana = make_account(app, "ana")
    bob = make_account(app, "bob")
    room = create_room(ana)
    join_room(bob, room)

    result = call(bob, method, url.format(room_id=room["id"]))

    assert result.status_code == 403
    assert call(ana, "GET", f"/api/rooms/{room['id']}").status_code == 200


def test_when_the_owner_leaves_the_member_who_joined_first_becomes_owner(app: Flask):
    ana = make_account(app, "ana")
    bob = make_account(app, "bob")
    carol = make_account(app, "carol")
    room = create_room(ana)
    join_room(bob, room)
    join_room(carol, room)

    assert call(ana, "POST", f"/api/rooms/{room['id']}/leave").status_code == 200

    ranking = body(call(bob, "GET", f"/api/rooms/{room['id']}"))["ranking"]
    assert [member["username"] for member in ranking if member["is_owner"]] == ["bob"]


def test_when_the_last_member_leaves_the_room_is_deleted_but_sessions_stay(app: Flask):
    ana = make_account(app, "ana")
    room = create_room(ana)
    seed_session(ana.user_id, SESSION_DAY, 600, room_id=room["id"])

    left = call(ana, "POST", f"/api/rooms/{room['id']}/leave")

    assert body(left)["room_deleted"] is True
    assert call(ana, "GET", f"/api/rooms/{room['id']}").status_code == 404
    assert len(list_sessions(ana)) == 1
    assert db.session.execute(select(Session)).scalar_one().room_id is None


def test_hidden_missions_are_masked_by_the_server(app: Flask):
    ana = make_account(app, "ana")
    bob = make_account(app, "bob")
    room = create_room(ana)
    join_room(bob, room)
    seed_session(ana.user_id, SESSION_DAY, 900, mission="secret plan", room_id=room["id"])
    call(ana, "PATCH", f"/api/rooms/{room['id']}/membership", {"showMissions": False})
    history_url = f"/api/rooms/{room['id']}/sessions?timezone=UTC"

    seen_by_bob = body(call(bob, "GET", history_url))["sessions"][0]
    seen_by_ana = body(call(ana, "GET", history_url))["sessions"][0]

    assert seen_by_bob["mission"] is None
    assert seen_by_bob["mission_hidden"] is True
    assert "secret plan" not in str(seen_by_bob)
    assert seen_by_bob["actual_time_seconds"] == 900
    assert seen_by_ana["mission"] == "secret plan"


def test_ranking_orders_by_total_time_then_join_order_and_totals_include_former_members(app: Flask):
    ana = make_account(app, "ana")
    bob = make_account(app, "bob")
    carol = make_account(app, "carol")
    dave = make_account(app, "dave")
    room = create_room(ana)

    for member in (bob, carol, dave):
        join_room(member, room)

    for member, seconds in ((ana, 600), (bob, 1800), (carol, 600), (dave, 300)):
        seed_session(member.user_id, SESSION_DAY, seconds, room_id=room["id"])

    call(dave, "POST", f"/api/rooms/{room['id']}/leave")
    snapshot = body(call(ana, "GET", f"/api/rooms/{room['id']}"))

    assert [(member["position"], member["username"], member["total_time_seconds"]) for member in snapshot["ranking"]] == [
        (1, "bob", 1800),
        (2, "ana", 600),
        (3, "carol", 600),
    ]
    assert snapshot["summary"] == {
        "total_time_seconds": 3300,
        "total_sessions": 4,
        "members_count": 3,
        "average_session_time_seconds": 825,
    }


def test_room_history_paging_visits_every_session_once(app: Flask):
    ana = make_account(app, "ana")
    room = create_room(ana)
    for hours_ago in range(25):
        seed_session(ana.user_id, SESSION_DAY - timedelta(hours=hours_ago), 60, room_id=room["id"])

    pages = all_pages(ana, f"/api/rooms/{room['id']}/sessions?timezone=UTC")

    assert [len(page) for page in pages] == [20, 5]
    assert len({session["id"] for page in pages for session in page}) == 25


def test_room_daily_summaries_count_only_that_rooms_sessions(app: Flask):
    ana = make_account(app, "ana")
    room = create_room(ana)
    seed_session(ana.user_id, SESSION_DAY, 900, room_id=room["id"])
    seed_session(ana.user_id, SESSION_DAY, 300)  # a personal session on the same day

    page = body(call(ana, "GET", f"/api/rooms/{room['id']}/sessions?timezone=UTC"))

    day = page["daily_summaries"]["2026-10-27"]
    assert (day["total_sessions"], day["total_time_seconds"]) == (1, 900)
