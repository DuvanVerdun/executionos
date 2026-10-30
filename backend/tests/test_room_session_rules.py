from room_session_rules import (
    RunningSessionFacts,
    actual_time_seconds,
    checkin_deadline_at,
    checkin_due_at,
    checkin_is_outstanding,
    overdue_reason,
)
from datetime import datetime, timedelta, UTC
import pytest
from dataclasses import replace

START = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)


def at(seconds: int) -> datetime:
    """A moment, counted in seconds after the session started."""
    return START + timedelta(seconds=seconds)


@pytest.fixture
def facts():
    return RunningSessionFacts(
        id=1,
        user_id=5,
        room_id=1,
        submission_id="a824c39f-9e4b-4513-835d-b9edb7d37f08",
        mission="x",
        target_time_seconds=1200,
        started_at=datetime(2026, 1, 1, 12, 0, tzinfo=UTC),
        paused_at=None,
        paused_seconds=0.0,
        last_checkin_mark=0,
        last_interaction_at=None,
        last_interaction_actual_seconds=None,
        last_heartbeat_at=datetime(2026, 1, 1, 12, 9, tzinfo=UTC)
    )

def test_actual_time_seconds_counts_elapsed_time_when_not_paused(facts: RunningSessionFacts):
    now = datetime(2026, 1, 1, 12, 10, tzinfo=UTC)

    result = actual_time_seconds(facts, now)

    assert result == 600


def test_actual_time_seconds_paused_session_freezes_its_time(facts: RunningSessionFacts):
    paused_facts = replace(facts, paused_at=datetime(2026, 1, 1, 12, 5, tzinfo=UTC))
    now = datetime(2026, 1, 1, 12, 30, tzinfo=UTC)

    result = actual_time_seconds(paused_facts, now)

    assert result == 300


# paused_at, last heartbeat, now (all in seconds after the start), and the expected reason
OVERDUE_CASES = [
    pytest.param(None, 570, 600, None, id="healthy session"),
    pytest.param(None, 600, 780, None, id="heartbeat exactly 180s old is not overdue yet"),
    pytest.param(None, 600, 781, "disconnected", id="heartbeat 181s old"),
    pytest.param(None, 3900, 3900, None, id="check-in deadline reached exactly is not overdue yet"),
    pytest.param(None, 3900, 3901, "missed_checkin", id="check-in not answered in time"),
    pytest.param(600, 4200, 4200, None, id="paused for exactly an hour is not overdue yet"),
    pytest.param(600, 4200, 4201, "paused_timeout", id="paused for over an hour"),
    pytest.param(None, 3720, 3901, "disconnected", id="two reasons at the same moment: disconnected wins"),
    pytest.param(None, 3840, 4100, "missed_checkin", id="two reasons: the earliest one wins"),
]


@pytest.mark.parametrize("paused_at, heartbeat, now, expected", OVERDUE_CASES)
def test_overdue_reason(
    facts: RunningSessionFacts,
    paused_at: int | None,
    heartbeat: int,
    now: int,
    expected: str | None,
):
    session = replace(
        facts,
        paused_at=at(paused_at) if paused_at is not None else None,
        last_heartbeat_at=at(heartbeat),
    )

    assert overdue_reason(session, at(now)) == expected


def test_checkin_is_due_an_hour_of_work_after_the_start_and_expires_five_minutes_later(facts: RunningSessionFacts):
    session = replace(facts, paused_seconds=600.0)

    assert checkin_due_at(session) == at(4200)
    assert checkin_deadline_at(session) == at(4500)
    assert not checkin_is_outstanding(session, at(4199))
    assert checkin_is_outstanding(session, at(4200))

    paused = replace(session, paused_at=at(700))
    assert not checkin_is_outstanding(paused, at(10_000))
