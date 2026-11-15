from __future__ import annotations
from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest
from flask import Flask
from sqlalchemy import update

from executionos.dashboard.streak import CalendarState, best_streak
from executionos.extensions import db
from executionos.models import Presence, User
from helpers import Account, body, call, make_account, request_without_token, seed_session

NOT_AVAILABLE = {"success": False, "error": "User not available"}
REPORT = {"state": "working", "mission": "write tests", "workedSeconds": 600, "targetSeconds": 3600}


def noon(days_ago: int) -> datetime:
    return datetime.now(UTC).replace(hour=12, minute=0, second=0, microsecond=0) - timedelta(days=days_ago)


def make_private(who: Account) -> None:
    db.session.execute(update(User).where(User.id == who.user_id).values(is_private=True))
    db.session.commit()


def follow(who: Account, other: str) -> None:
    call(who, "PUT", f"/api/users/{other}/follow")


def profile(who: Account, username: str) -> dict[str, Any]:
    response = call(who, "GET", f"/api/users/{username}?timezone=UTC")
    assert response.status_code == 200
    return body(response)["profile"]


def following(who: Account) -> dict[str, Any]:
    return body(call(who, "GET", "/api/following?timezone=UTC"))


def search(who: Account, query: str) -> list[dict[str, Any]]:
    return body(call(who, "GET", f"/api/user-search?q={query}"))["users"]


@pytest.mark.parametrize("url", ["/api/following?timezone=UTC", "/api/user-search?q=lu", "/api/users/lucia?timezone=UTC"])
def test_every_read_needs_a_signed_in_user(app: Flask, url: str) -> None:
    assert request_without_token(app.test_client(), "GET", url).status_code == 401


@pytest.mark.parametrize("url", ["/api/following", "/api/users/lucia", "/api/following?timezone=Mars/Base"])
def test_a_missing_or_unknown_timezone_is_rejected(app: Flask, url: str) -> None:
    duvan = make_account(app, "duvan")
    make_account(app, "lucia")

    assert call(duvan, "GET", url).status_code == 400


def test_the_best_streak_is_the_longest_run_of_work_days() -> None:
    kinds: list[CalendarState] = ["work", "work", "rest", "work", "missed", "work", "today"]
    states: dict[date, CalendarState] = {date(2026, 11, 1 + offset): kind for offset, kind in enumerate(kinds)}

    assert best_streak(states) == 3


def test_you_see_your_own_data(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    for days_ago in (20, 19, 18, 1, 0):
        seed_session(duvan.user_id, noon(days_ago), 600)

    own = profile(duvan, "duvan")

    assert (own["relation"], own["followers_count"], own["following_count"]) == ("self", 0, 0)
    assert own["data"]["streak"] == {"current": 2, "best": 3}


def test_the_data_has_a_six_month_heatmap_that_ends_today(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    seed_session(duvan.user_id, noon(0), 600)

    heatmap = profile(duvan, "duvan")["data"]["heatmap"]

    today = datetime.now(UTC).date()
    start = datetime.fromisoformat(heatmap["start_date"]).date()
    assert len(heatmap["states"]) == 182
    assert start.weekday() == 0
    assert heatmap["states"][(today - start).days] == "work"
    assert set(heatmap["states"][(today - start).days + 1:]) <= {"neutral"}


def test_the_stats_cover_the_last_thirty_days(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    seed_session(duvan.user_id, noon(0), 600)
    seed_session(duvan.user_id, noon(0), 1200)
    seed_session(duvan.user_id, noon(29), 300)
    seed_session(duvan.user_id, noon(30), 9999)

    stats = profile(duvan, "duvan")["data"]["stats"]

    assert stats == {
        "total_time_seconds": 2100,
        "total_sessions": 3,
        "days_worked": 2,
        "average_session_time_seconds": 700,
    }


def test_a_user_without_sessions_has_empty_stats(app: Flask) -> None:
    duvan = make_account(app, "duvan")

    data = profile(duvan, "duvan")["data"]

    assert data["streak"] == {"current": 0, "best": 0}
    assert data["last_activity_at"] is None
    assert data["stats"]["average_session_time_seconds"] is None


@pytest.mark.parametrize("private", [False, True])
def test_someone_who_does_not_follow_sees_only_the_card(app: Flask, private: bool) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")
    mateo = make_account(app, "mateo")
    seed_session(lucia.user_id, noon(0), 600)
    follow(mateo, "lucia")
    if private:
        make_private(lucia)

    card = profile(duvan, "lucia")

    assert (card["relation"], card["is_private"], card["followers_count"], card["data"]) == ("none", private, 1, None)


def test_a_pending_request_does_not_open_the_data(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")
    make_private(lucia)
    follow(duvan, "lucia")

    card = profile(duvan, "lucia")

    assert (card["relation"], card["data"], card["followers_count"]) == ("requested", None, 0)


def test_a_follower_sees_the_data_and_the_counts(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")
    mateo = make_account(app, "mateo")
    seed_session(lucia.user_id, noon(0), 600)
    follow(duvan, "lucia")
    follow(lucia, "mateo")
    follow(mateo, "lucia")

    seen = profile(duvan, "lucia")

    assert (seen["relation"], seen["followers_count"], seen["following_count"]) == ("following", 2, 1)
    assert seen["data"]["streak"]["current"] == 1
    assert seen["data"]["last_activity_at"] is not None


def test_the_card_says_when_they_follow_you(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")
    follow(lucia, "duvan")

    assert profile(duvan, "lucia")["follows_you"] is True
    assert profile(lucia, "duvan")["follows_you"] is False


def test_a_missing_user_and_a_blocked_one_look_the_same(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")
    call(lucia, "PUT", "/api/blocks/duvan")

    for username in ("nobody", "lucia"):
        response = call(duvan, "GET", f"/api/users/{username}?timezone=UTC")
        assert (response.status_code, body(response)) == (404, NOT_AVAILABLE)


def test_the_live_state_of_a_follower_session_is_shown_to_the_followers(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")
    follow(duvan, "lucia")
    call(lucia, "PUT", "/api/presence", REPORT)

    live = profile(duvan, "lucia")["data"]["live"]

    assert (live["state"], live["mission"], live["target_seconds"]) == ("working", "write tests", 3600)
    assert live["percentage"] == 16


def test_a_stale_report_means_not_working(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")
    follow(duvan, "lucia")
    call(lucia, "PUT", "/api/presence", REPORT)
    db.session.execute(update(Presence).values(reported_at=datetime.now(UTC) - timedelta(seconds=600)))
    db.session.commit()

    live = profile(duvan, "lucia")["data"]["live"]

    assert live == {"state": "not_working", "percentage": None, "mission": None, "worked_seconds": None, "target_seconds": None}


def test_the_list_has_the_requests_and_the_people_you_follow(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    lucia = make_account(app, "lucia")
    ana = make_account(app, "ana")
    mateo = make_account(app, "mateo")
    noa = make_account(app, "noa")
    make_private(duvan)
    for name in ("lucia", "mateo", "noa"):
        follow(duvan, name)
    follow(ana, "duvan")
    seed_session(lucia.user_id, noon(0), 600)
    seed_session(lucia.user_id, noon(1), 600)
    call(noa, "PUT", "/api/presence", REPORT)
    call(mateo, "PUT", "/api/presence", {**REPORT, "state": "paused"})

    result = following(duvan)

    assert result["requests"] == [{"username": "ana"}]
    assert [(entry["username"], entry["streak"], entry["live"]["state"]) for entry in result["following"]] == [
        ("noa", 0, "working"),
        ("mateo", 0, "paused"),
        ("lucia", 2, "not_working"),
    ]


def test_the_list_is_empty_for_a_new_user(app: Flask) -> None:
    assert following(make_account(app, "duvan")) == {"success": True, "requests": [], "following": []}


def test_a_pending_request_is_not_in_the_people_you_follow(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    make_private(make_account(app, "lucia"))
    follow(duvan, "lucia")

    assert following(duvan)["following"] == []


def test_search_finds_usernames_that_start_with_the_query_and_never_yourself(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    for name in ("maria", "mateo", "samuel", "madison"):
        make_account(app, name)

    assert [user["username"] for user in search(duvan, "MA")] == ["madison", "maria", "mateo"]
    assert search(duvan, "du") == []


def test_search_needs_at_least_two_characters(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    make_account(app, "maria")

    assert search(duvan, "m") == []
    assert search(duvan, "") == []


def test_search_reads_percent_and_underscore_as_plain_characters(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    make_account(app, "ab")
    make_account(app, "a_c")

    assert [user["username"] for user in search(duvan, "a_")] == ["a_c"]
    assert search(duvan, "%%") == []


def test_search_shows_how_you_relate_to_each_result(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    make_account(app, "mateo")
    make_private(make_account(app, "maria"))
    make_account(app, "marta")
    follow(duvan, "mateo")
    follow(duvan, "maria")

    assert [(user["username"], user["is_private"], user["relation"]) for user in search(duvan, "ma")] == [
        ("maria", True, "requested"),
        ("marta", False, "none"),
        ("mateo", False, "following"),
    ]


def test_search_hides_users_blocked_in_either_direction(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    maria = make_account(app, "maria")
    make_account(app, "marta")
    make_account(app, "mateo")
    call(duvan, "PUT", "/api/blocks/marta")
    call(maria, "PUT", "/api/blocks/duvan")

    assert [user["username"] for user in search(duvan, "ma")] == ["mateo"]
    assert search(maria, "du") == []


def test_search_returns_at_most_ten_users(app: Flask) -> None:
    duvan = make_account(app, "duvan")
    for number in range(12):
        make_account(app, f"user{number:02d}")

    assert len(search(duvan, "us")) == 10
