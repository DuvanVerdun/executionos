from __future__ import annotations
from datetime import UTC, date, datetime
from typing import Any

import pytest
from flask import Flask

from executionos.dashboard.streak import calculate_streak_states
from helpers import Account, body, call, dashboard, list_sessions, make_account, save_session

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
    streak, rest_days_left, _ = calculate_streak_states(work_days, today)

    assert streak == expected_streak
    assert rest_days_left == expected_rest_days_left


def test_today_without_work_is_its_own_state_even_for_a_user_with_no_sessions():
    today = date(2026, 10, 29)

    _, _, states = calculate_streak_states(set(), today)
    _, _, states_after_work = calculate_streak_states({date(2026, 10, 27)}, today)

    assert states == {today: "today"}
    assert states_after_work[today] == "today"
    assert states_after_work[date(2026, 10, 28)] == "rest"


def streak_calendar(who: Account, anchor_date: str) -> dict[str, Any]:
    return body(call(who, "GET", f"/api/streak?anchor_date={anchor_date}&timezone=UTC"))


def test_the_calendar_shows_today_in_gray_until_there_is_work_and_the_days_after_it_stay_neutral(app: Flask):
    ana = make_account(app, "ana")
    today = datetime.now(UTC).date()
    days = {day["date"]: day for day in streak_calendar(ana, today.isoformat())["calendar"]["days"]}

    assert days[today.isoformat()]["state"] == "today"

    save_session(ana, date=datetime.now(UTC).isoformat(), actualTimeSeconds=600)
    days = {day["date"]: day for day in streak_calendar(ana, today.isoformat())["calendar"]["days"]}

    assert days[today.isoformat()]["state"] == "work"
    assert days[today.isoformat()]["total_sessions"] == 1


def test_each_calendar_day_has_its_session_count_and_time_and_the_total_counts_days_worked_ever(app: Flask):
    ana = make_account(app, "ana")
    save_session(ana, date="2026-10-27T12:00:00Z", actualTimeSeconds=600)
    save_session(ana, date="2026-10-27T15:00:00Z", actualTimeSeconds=300)
    save_session(ana, date="2026-10-28T12:00:00Z", actualTimeSeconds=0)
    save_session(ana, date="2026-09-01T12:00:00Z", actualTimeSeconds=900)

    october = streak_calendar(ana, "2026-10-01")
    days = {day["date"]: day for day in october["calendar"]["days"]}

    assert (days["2026-10-27"]["total_sessions"], days["2026-10-27"]["total_time_seconds"]) == (2, 900)
    assert (days["2026-10-28"]["total_sessions"], days["2026-10-28"]["total_time_seconds"]) == (1, 0)
    assert (days["2026-10-29"]["total_sessions"], days["2026-10-29"]["total_time_seconds"]) == (0, 0)
    assert october["total_worked_days"] == 2
    assert streak_calendar(ana, "2026-09-01")["total_worked_days"] == 2


def test_the_total_of_days_worked_is_zero_for_a_new_user(app: Flask):
    ana = make_account(app, "ana")

    assert streak_calendar(ana, "2026-10-01")["total_worked_days"] == 0


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
