from __future__ import annotations
from datetime import date
from typing import Any

import pytest
from flask import Flask

from dashboard_service import _calculate_streak_states  # pyright: ignore[reportPrivateUsage]
from helpers import body, call, dashboard, list_sessions, make_account, save_session

# work days, today, expected streak, expected rest days left this week
STREAK_CASES = [
    pytest.param({date(2026, 10, 26), date(2026, 10, 27), date(2026, 10, 28)}, date(2026, 10, 28), 3, 2, id="three days in a row"),
    pytest.param({date(2026, 10, 26)}, date(2026, 10, 29), 1, 0, id="two rest days keep the streak alive"),
    pytest.param({date(2026, 10, 26)}, date(2026, 10, 30), 0, 0, id="a third idle day breaks it"),
    pytest.param({date(2026, 10, 30), date(2026, 11, 2)}, date(2026, 11, 2), 2, 2, id="a weekend of rest does not break it"),
    pytest.param(set[date](), date(2026, 10, 28), 0, 2, id="no work at all"),
]

# period, anchor date, expected start date, expected end date
BOUNDS_CASES = [
    pytest.param("week", "2026-10-28", "2026-10-26", "2026-11-01", id="week starts on Monday"),
    pytest.param("month", "2026-12-15", "2026-12-01", "2026-12-31", id="December ends on the 31st"),
    pytest.param("month", "2028-02-10", "2028-02-01", "2028-02-29", id="leap-year February"),
    pytest.param("year", "2026-06-15", "2026-01-01", "2026-12-31", id="whole year"),
    pytest.param("all_time", "2026-10-28", None, "2026-10-28", id="all time has no start"),
]


@pytest.mark.parametrize("work_days, today, expected_streak, expected_rest_days_left", STREAK_CASES)
def test_streak_rules(
    work_days: set[date],
    today: date,
    expected_streak: int,
    expected_rest_days_left: int,
):
    streak, rest_days_left, _ = _calculate_streak_states(work_days, today)

    assert streak == expected_streak
    assert rest_days_left == expected_rest_days_left


@pytest.mark.parametrize("period, anchor_date, start_date, end_date", BOUNDS_CASES)
def test_period_bounds(app: Flask, period: str, anchor_date: str, start_date: str | None, end_date: str):
    ana = make_account(app, "ana")

    result = call(ana, "GET", f"/api/dashboard?period={period}&anchor_date={anchor_date}&timezone=UTC")

    assert result.status_code == 200
    assert body(result)["period"] == {
        "type": period,
        "anchor_date": anchor_date,
        "start_date": start_date,
        "end_date": end_date,
    }


def sessions_per_day(result: dict[str, Any]) -> dict[str, int]:
    return {day["bucket_start"]: day["total_sessions"] for day in result["trend"] if day["total_sessions"]}


def test_dashboard_numbers_and_days_follow_the_users_timezone(app: Flask):
    ana = make_account(app, "ana")
    save_session(ana, date="2026-10-27T12:00:00Z", actualTimeSeconds=1800)
    save_session(ana, date="2026-10-28T02:00:00Z", actualTimeSeconds=3600)

    in_utc = dashboard(ana, "week", "2026-10-28", "UTC")
    in_buenos_aires = dashboard(ana, "week", "2026-10-28", "America/Argentina/Buenos_Aires")

    for result in (in_utc, in_buenos_aires):
        assert result["summary"] == {
            "total_time_seconds": 5400,
            "total_sessions": 2,
            "average_completion_percentage": 75.0,
            "average_session_time_seconds": 2700,
        }

    # 02:00 UTC on Wednesday is still 23:00 on Tuesday in Buenos Aires.
    assert sessions_per_day(in_utc) == {"2026-10-27": 1, "2026-10-28": 1}
    assert sessions_per_day(in_buenos_aires) == {"2026-10-27": 2}


def test_dashboard_and_session_list_show_only_the_users_own_sessions(app: Flask):
    ana = make_account(app, "ana")
    bob = make_account(app, "bob")
    save_session(ana, mission="ana-1")
    save_session(ana, mission="ana-2")
    save_session(bob, mission="bob-1")

    assert dashboard(ana, "week", "2026-10-28", "UTC")["summary"]["total_sessions"] == 2
    assert dashboard(bob, "week", "2026-10-28", "UTC")["summary"]["total_sessions"] == 1
    assert {session["mission"] for session in list_sessions(ana)} == {"ana-1", "ana-2"}
    assert {session["mission"] for session in list_sessions(bob)} == {"bob-1"}
