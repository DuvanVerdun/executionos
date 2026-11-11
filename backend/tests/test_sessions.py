from __future__ import annotations
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
from flask import Flask

from helpers import (
    SESSION_DAY,
    all_pages,
    body,
    call,
    create_room,
    join_room,
    list_sessions,
    make_account,
    save_session,
    seed_session,
)

INVALID_SESSIONS = [
    pytest.param({"actualTimeSeconds": -1}, id="negative actual time"),
    pytest.param({"targetTimeSeconds": 0}, id="zero target time"),
    pytest.param({"targetTimeSeconds": True}, id="a boolean instead of a number"),
    pytest.param({"mission": "x" * 201}, id="mission too long"),
    pytest.param({"mission": "   "}, id="blank mission"),
    pytest.param({"date": 123}, id="date is not text"),
]


def test_saving_the_same_submission_twice_stores_one_session(app: Flask):
    ana = make_account(app, "ana")
    submission_id = str(uuid4())

    first = save_session(ana, submissionId=submission_id)
    second = save_session(ana, submissionId=submission_id)

    assert (first.status_code, second.status_code) == (201, 200)
    assert body(first)["session_id"] == body(second)["session_id"]
    assert len(list_sessions(ana)) == 1


@pytest.mark.parametrize("overrides", INVALID_SESSIONS)
def test_invalid_sessions_are_rejected_and_not_saved(app: Flask, overrides: dict[str, Any]):
    ana = make_account(app, "ana")

    result = save_session(ana, **overrides)

    assert result.status_code == 400
    assert body(result)["success"] is False
    assert list_sessions(ana) == []


def test_a_user_cannot_delete_someone_elses_session(app: Flask):
    ana = make_account(app, "ana")
    bob = make_account(app, "bob")
    session_id = body(save_session(ana))["session_id"]

    someone_elses = call(bob, "DELETE", f"/api/delete-session/{session_id}")
    missing = call(bob, "DELETE", "/api/delete-session/999999")

    assert someone_elses.status_code == missing.status_code == 404
    assert body(someone_elses) == body(missing)
    assert len(list_sessions(ana)) == 1


def test_a_user_can_change_the_mission_of_their_session_and_nothing_else(app: Flask):
    ana = make_account(app, "ana")
    session_id = body(save_session(ana))["session_id"]
    before = list_sessions(ana)[0]

    result = call(ana, "PATCH", f"/api/update-session/{session_id}", {
        "mission": "  write better tests  ",
        "targetTimeSeconds": 1,
        "actualTimeSeconds": 1,
        "date": "2020-01-01T00:00:00Z",
    })

    assert result.status_code == 200
    assert body(result)["mission"] == "write better tests"
    after = list_sessions(ana)[0]
    assert after == {**before, "mission": "write better tests"}


@pytest.mark.parametrize("payload", [
    pytest.param({}, id="no mission"),
    pytest.param({"mission": "   "}, id="blank mission"),
    pytest.param({"mission": "x" * 201}, id="mission too long"),
    pytest.param({"mission": 5}, id="mission is not text"),
])
def test_an_invalid_mission_is_rejected_and_the_session_does_not_change(app: Flask, payload: dict[str, Any]):
    ana = make_account(app, "ana")
    session_id = body(save_session(ana))["session_id"]

    result = call(ana, "PATCH", f"/api/update-session/{session_id}", payload)

    assert result.status_code == 400
    assert body(result)["success"] is False
    assert list_sessions(ana)[0]["mission"] == "write tests"


def test_a_user_cannot_change_someone_elses_session(app: Flask):
    ana = make_account(app, "ana")
    bob = make_account(app, "bob")
    session_id = body(save_session(ana))["session_id"]

    someone_elses = call(bob, "PATCH", f"/api/update-session/{session_id}", {"mission": "hijacked"})
    missing = call(bob, "PATCH", "/api/update-session/999999", {"mission": "hijacked"})

    assert someone_elses.status_code == missing.status_code == 404
    assert body(someone_elses) == body(missing)
    assert list_sessions(ana)[0]["mission"] == "write tests"


def test_a_member_can_change_the_mission_of_their_own_room_session_but_not_of_another_member(app: Flask):
    ana = make_account(app, "ana")
    bob = make_account(app, "bob")
    room = create_room(ana)
    join_room(bob, room)
    seed_session(ana.user_id, SESSION_DAY, 900, mission="old plan", room_id=room["id"])
    history_url = f"/api/rooms/{room['id']}/sessions?timezone=UTC"
    session_id = body(call(ana, "GET", history_url))["sessions"][0]["id"]

    by_bob = call(bob, "PATCH", f"/api/update-session/{session_id}", {"mission": "hijacked"})
    by_ana = call(ana, "PATCH", f"/api/update-session/{session_id}", {"mission": "new plan"})

    assert by_bob.status_code == 404
    assert by_ana.status_code == 200
    seen_by_bob = body(call(bob, "GET", history_url))["sessions"][0]
    assert seen_by_bob["mission"] == "new plan"
    assert seen_by_bob["actual_time_seconds"] == 900


def test_a_saved_mission_is_stored_without_the_spaces_around_it(app: Flask):
    ana = make_account(app, "ana")

    save_session(ana, mission="  spaced out  ")

    assert list_sessions(ana)[0]["mission"] == "spaced out"


def test_paging_visits_every_session_once_newest_first(app: Flask):
    ana = make_account(app, "ana")
    for hours_ago in range(22):
        seed_session(ana.user_id, SESSION_DAY - timedelta(hours=hours_ago), 60)
    for _ in range(3):
        seed_session(ana.user_id, SESSION_DAY - timedelta(days=1), 60)  # same moment: the id breaks the tie
    today = datetime.now(UTC).date().isoformat()

    pages = all_pages(ana, f"/api/get-sessions?period=all_time&anchor_date={today}&timezone=UTC")

    sessions = [session for page in pages for session in page]
    assert [len(page) for page in pages] == [20, 5]
    assert len({session["id"] for session in sessions}) == 25
    newest_first = [(session["date"], session["id"]) for session in sessions]
    assert newest_first == sorted(newest_first, reverse=True)


def test_daily_summaries_count_only_the_users_own_sessions(app: Flask):
    ana = make_account(app, "ana")
    bob = make_account(app, "bob")
    save_session(ana, actualTimeSeconds=1800)
    save_session(bob, actualTimeSeconds=600)  # same day, someone else
    today = datetime.now(UTC).date().isoformat()

    page = body(call(ana, "GET", f"/api/get-sessions?period=all_time&anchor_date={today}&timezone=UTC"))

    assert page["daily_summaries"] == {
        "2026-10-27": {
            "total_sessions": 1,
            "total_time_seconds": 1800,
            "average_completion_percentage": 50.0,
            "average_session_time_seconds": 1800,
        }
    }
