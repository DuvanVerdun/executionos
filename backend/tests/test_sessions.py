from __future__ import annotations
from typing import Any
from uuid import uuid4

import pytest
from flask import Flask

from helpers import body, call, list_sessions, make_account, save_session

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
