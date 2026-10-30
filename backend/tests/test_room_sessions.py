from __future__ import annotations
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from flask import Flask
from sqlalchemy import select

from extensions import db
from helpers import (
    body,
    call,
    create_room,
    join_room,
    list_sessions,
    make_account,
    start_room_session,
)
from models import ActiveRoomSession


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
