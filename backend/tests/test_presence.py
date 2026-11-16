from __future__ import annotations
from typing import Any

import pytest
from flask import Flask
from sqlalchemy import select

from executionos.extensions import db
from executionos.models import Presence
from helpers import body, call, make_account, request_without_token

REPORT = {"state": "working", "mission": "write tests", "workedSeconds": 600, "targetSeconds": 3600}


def stored_reports() -> list[Presence]:
    return list(db.session.execute(select(Presence)).scalars())


@pytest.mark.parametrize("method", ["PUT", "DELETE"])
def test_presence_needs_a_signed_in_user(app: Flask, method: str) -> None:
    assert request_without_token(app.test_client(), method, "/api/presence").status_code == 401


def test_a_report_is_stored(app: Flask) -> None:
    duvan = make_account(app, "duvan")

    response = call(duvan, "PUT", "/api/presence", REPORT)

    assert response.status_code == 200
    assert body(response) == {"success": True}
    [report] = stored_reports()
    assert (report.user_id, report.state, report.mission, report.worked_seconds, report.target_seconds) == (
        duvan.user_id, "working", "write tests", 600, 3600
    )


def test_a_new_report_replaces_the_last_one(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    call(duvan, "PUT", "/api/presence", REPORT)

    call(duvan, "PUT", "/api/presence", {**REPORT, "state": "paused", "workedSeconds": 900})

    [report] = stored_reports()
    assert (report.state, report.worked_seconds) == ("paused", 900)


def test_each_user_has_their_own_report(app: Flask) -> None:
    call(make_account(app, "duvan"), "PUT", "/api/presence", REPORT)
    call(make_account(app, "lucia"), "PUT", "/api/presence", REPORT)

    assert len(stored_reports()) == 2


@pytest.mark.parametrize("change", [
    {"state": "idle"},
    {"state": None},
    {"mission": ""},
    {"mission": "x" * 201},
    {"workedSeconds": -1},
    {"workedSeconds": True},
    {"workedSeconds": 1.5},
    {"workedSeconds": 10**9},
    {"targetSeconds": 0},
    {"targetSeconds": "3600"},
])
def test_an_invalid_report_is_rejected_and_stores_nothing(app: Flask, change: dict[str, Any]) -> None:
    duvan = make_account(app, "duvan")

    response = call(duvan, "PUT", "/api/presence", {**REPORT, **change})

    assert response.status_code == 400
    assert stored_reports() == []


def test_a_report_must_be_a_json_object(app: Flask) -> None:
    duvan = make_account(app, "duvan")

    assert call(duvan, "PUT", "/api/presence").status_code == 400


def test_clearing_forgets_only_the_report_of_that_user(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")
    call(duvan, "PUT", "/api/presence", REPORT)
    call(lucia, "PUT", "/api/presence", REPORT)

    response = call(duvan, "DELETE", "/api/presence")

    assert response.status_code == 200
    assert [report.user_id for report in stored_reports()] == [lucia.user_id]


def test_clearing_without_a_report_is_fine(app: Flask) -> None:
    assert call(make_account(app, "duvan"), "DELETE", "/api/presence").status_code == 200
