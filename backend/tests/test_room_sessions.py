from __future__ import annotations
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
from flask import Flask
from sqlalchemy import select

from executionos.extensions import db
from helpers import (
    Account,
    body,
    call,
    create_room,
    join_room,
    list_sessions,
    make_account,
    start_room_session,
)
from executionos.models import ActiveRoomSession


def test_start_pause_finish_saves_the_session_in_both_places(app: Flask):
    ana = make_account(app, "ana")
    room = create_room(ana)

    started = start_room_session(ana, room["id"], "write tests")
    submission_id = body(started)["session"]["submission_id"]
    finish_payload = {"submissionId": submission_id}

    assert started.status_code == 201
    assert call(ana, "POST", "/api/room-session/finish", finish_payload).status_code == 409  # still running
    assert call(ana, "POST", "/api/room-session/pause").status_code == 200

    finished = body(call(ana, "POST", "/api/room-session/finish", finish_payload))
    in_room = body(call(ana, "GET", f"/api/rooms/{room['id']}/sessions?timezone=UTC"))["sessions"]

    assert finished["saved"] is True
    assert finished["active"] is False
    assert [session["mission"] for session in list_sessions(ana)] == ["write tests"]
    assert [session["mission"] for session in in_room] == ["write tests"]


def test_a_user_can_have_only_one_running_session(app: Flask):
    ana = make_account(app, "ana")
    first_room = create_room(ana, "First")
    second_room = create_room(ana, "Second")
    start_room_session(ana, first_room["id"])

    second = start_room_session(ana, second_room["id"])

    assert second.status_code == 409
    assert body(second)["success"] is False
    assert body(second)["active"] is True
    assert body(second)["session"]["room_id"] == first_room["id"]


@pytest.mark.parametrize("pause_first", [False, True], ids=["running", "paused"])
@pytest.mark.parametrize("method, url", [("POST", "/leave"), ("DELETE", "")], ids=["leave", "delete"])
def test_cannot_leave_or_delete_a_room_while_a_session_is_running_or_paused(
    app: Flask,
    method: str,
    url: str,
    pause_first: bool,
):
    ana = make_account(app, "ana")
    room = create_room(ana)
    start_room_session(ana, room["id"])

    if pause_first:
        call(ana, "POST", "/api/room-session/pause")

    result = call(ana, method, f"/api/rooms/{room['id']}{url}")

    assert result.status_code == 409
    assert call(ana, "GET", f"/api/rooms/{room['id']}").status_code == 200


@pytest.mark.parametrize(
    "had_interaction, expected_saved_seconds",
    [(True, 1800), (False, None)],
    ids=["saved at the last pause or check-in", "nothing to save"],
)
def test_a_silent_session_is_closed_by_the_next_read_and_the_user_is_told(
    app: Flask,
    had_interaction: bool,
    expected_saved_seconds: int | None,
):
    ana = make_account(app, "ana")
    bob = make_account(app, "bob")
    room = create_room(ana)
    join_room(bob, room)

    now = datetime.now(UTC)
    row = ActiveRoomSession(
        user_id=ana.user_id,
        room_id=room["id"],
        submission_id=str(uuid4()),
        mission="gone quiet",
        target_time_seconds=3600,
        started_at=now - timedelta(hours=2),
    )
    row.last_heartbeat_at = now - timedelta(hours=1)
    if had_interaction:
        row.last_interaction_at = now - timedelta(hours=1, minutes=30)
        row.last_interaction_actual_seconds = 1800
    db.session.add(row)
    db.session.commit()

    # Someone else reading the room is enough to close it, before Ana asks anything.
    ranking = body(call(bob, "GET", f"/api/rooms/{room['id']}"))["ranking"]
    still_running = db.session.execute(select(ActiveRoomSession.id)).first()
    envelope = body(call(ana, "GET", "/api/room-session"))

    assert {member["username"]: member["state"] for member in ranking}["ana"] == "not_working"
    assert still_running is None
    assert envelope["active"] is False
    assert envelope["notice"] == {
        "reason": "disconnected",
        "saved": had_interaction,
        "actual_time_seconds": expected_saved_seconds,
    }
    assert [session["actual_time_seconds"] for session in list_sessions(ana)] == (
        [1800] if had_interaction else []
    )


def start_and_move_the_start_back(ana: Account, room: dict[str, Any], seconds: int) -> str:
    """Start a session and make the server think it started `seconds` ago. Return its submission ID."""
    started = start_room_session(ana, room["id"], "write tests")
    row = db.session.execute(select(ActiveRoomSession)).scalar_one()
    row.started_at = row.started_at - timedelta(seconds=seconds)
    db.session.commit()
    return str(body(started)["session"]["submission_id"])


def saved_seconds(ana: Account) -> list[int]:
    return [session["actual_time_seconds"] for session in list_sessions(ana)]


def test_the_time_the_client_counted_is_the_time_that_is_saved(app: Flask):
    ana = make_account(app, "ana")
    room = create_room(ana)
    submission_id = start_and_move_the_start_back(ana, room, 2000)

    paused = body(call(ana, "POST", "/api/room-session/pause", {"workedSeconds": 1800}))
    finished = call(ana, "POST", "/api/room-session/finish", {"submissionId": submission_id, "actualSeconds": 1800})

    assert paused["session"]["actual_time_seconds"] == 1800
    assert finished.status_code == 200
    assert saved_seconds(ana) == [1800]


def test_without_the_clients_count_the_server_counts_the_time_itself(app: Flask):
    ana = make_account(app, "ana")
    room = create_room(ana)
    submission_id = start_and_move_the_start_back(ana, room, 2000)

    call(ana, "POST", "/api/room-session/pause")
    call(ana, "POST", "/api/room-session/finish", {"submissionId": submission_id})

    assert [seconds for seconds in saved_seconds(ana) if 1999 <= seconds <= 2001] != []


def test_a_count_far_above_the_servers_elapsed_time_is_limited(app: Flask):
    ana = make_account(app, "ana")
    room = create_room(ana)
    submission_id = start_and_move_the_start_back(ana, room, 100)

    call(ana, "POST", "/api/room-session/pause", {"workedSeconds": 99_999})
    call(ana, "POST", "/api/room-session/finish", {"submissionId": submission_id, "actualSeconds": 99_999})

    [seconds] = saved_seconds(ana)
    assert 100 <= seconds <= 111


@pytest.mark.parametrize("worked", [-1, "abc", True, 1.5, [5]], ids=["negative", "text", "boolean", "decimal", "list"])
def test_an_invalid_count_is_rejected_and_the_session_does_not_change(app: Flask, worked: object):
    ana = make_account(app, "ana")
    room = create_room(ana)
    submission_id = start_and_move_the_start_back(ana, room, 100)

    paused = call(ana, "POST", "/api/room-session/pause", {"workedSeconds": worked})
    checked_in = call(ana, "POST", "/api/room-session/checkin", {"workedSeconds": worked})
    call(ana, "POST", "/api/room-session/pause")
    finished = call(ana, "POST", "/api/room-session/finish", {"submissionId": submission_id, "actualSeconds": worked})

    assert (paused.status_code, checked_in.status_code, finished.status_code) == (400, 400, 400)
    assert body(call(ana, "GET", "/api/room-session"))["session"]["state"] == "paused"
    assert saved_seconds(ana) == []


def test_others_see_the_clients_count_of_a_paused_session(app: Flask):
    ana = make_account(app, "ana")
    bob = make_account(app, "bob")
    room = create_room(ana)
    join_room(bob, room)
    start_and_move_the_start_back(ana, room, 2000)
    call(ana, "POST", "/api/room-session/pause", {"workedSeconds": 1800})

    summary = body(call(ana, "GET", f"/api/rooms/{room['id']}/summary?include_my_running_session=true"))["summary"]

    assert summary["total_time_seconds"] == 1800


@pytest.mark.parametrize(
    "seconds_since_start, next_mark",
    [(3500, 1), (3550, 2), (3700, 2), (3950, None)],
    ids=["too early: ignored", "a little early: accepted", "after the hour: accepted", "after the deadline: the session ended"],
)
def test_a_check_in_is_accepted_from_a_little_before_it_is_due_until_its_deadline(
    app: Flask,
    seconds_since_start: int,
    next_mark: int | None,
):
    ana = make_account(app, "ana")
    room = create_room(ana)
    start_and_move_the_start_back(ana, room, seconds_since_start)

    envelope = body(call(ana, "POST", "/api/room-session/checkin", {"workedSeconds": seconds_since_start}))

    if next_mark is None:
        assert envelope["active"] is False
    else:
        assert envelope["session"]["checkin"]["mark"] == next_mark
