from __future__ import annotations
from datetime import UTC, datetime, timedelta

from executionos.social.rules import (
    PRESENCE_TIMEOUT_SECONDS,
    PresenceFacts,
    live_state,
    live_worked_seconds,
    ring_percentage,
)

NOW = datetime(2026, 11, 16, 12, 0, tzinfo=UTC)


def facts(state: str = "working", worked: int = 600, target: int = 3600, age_seconds: int = 0) -> PresenceFacts:
    return PresenceFacts(
        state="paused" if state == "paused" else "working",
        mission="write tests",
        worked_seconds=worked,
        target_seconds=target,
        reported_at=NOW - timedelta(seconds=age_seconds),
    )


def test_no_report_means_not_working() -> None:
    assert live_state(None, NOW) == "not_working"


def test_a_fresh_report_shows_its_state() -> None:
    assert live_state(facts("working"), NOW) == "working"
    assert live_state(facts("paused"), NOW) == "paused"


def test_a_report_is_stale_only_when_strictly_older_than_the_timeout() -> None:
    assert live_state(facts(age_seconds=PRESENCE_TIMEOUT_SECONDS), NOW) == "working"
    assert live_state(facts(age_seconds=PRESENCE_TIMEOUT_SECONDS + 1), NOW) == "not_working"


def test_working_time_grows_with_the_time_since_the_report() -> None:
    assert live_worked_seconds(facts("working", worked=600, age_seconds=30), NOW) == 630


def test_paused_time_stays_where_the_client_left_it() -> None:
    assert live_worked_seconds(facts("paused", worked=600, age_seconds=120), NOW) == 600


def test_the_ring_never_goes_past_a_hundred() -> None:
    assert ring_percentage(facts(worked=1800, target=3600), NOW) == 50
    assert ring_percentage(facts(worked=7200, target=3600), NOW) == 100
