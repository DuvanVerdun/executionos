from executionos.rooms.rules import (
    RunningSessionFacts,
    actual_time_seconds,
    checkin_can_be_confirmed,
    checkin_deadline_at,
    checkin_due_at,
    checkin_is_outstanding,
    clamp_reported_seconds,
    current_worked_seconds,
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


@pytest.mark.parametrize(
    "reported, elapsed, expected",
    [
        pytest.param(1800, 2000, 1800, id="a count below the server's elapsed time is kept"),
        pytest.param(2005, 2000, 2005, id="a few seconds above it are allowed, for the delay of the request"),
        pytest.param(99_999, 2000, 2010, id="a count far above it is limited to the elapsed time plus the margin"),
        pytest.param(0, 2000, 0, id="zero is kept"),
        pytest.param(5, 0, 5, id="a count right after the start is kept"),
    ],
)
def test_a_reported_time_is_limited_by_the_servers_elapsed_time_plus_a_margin(
    facts: RunningSessionFacts,
    reported: int,
    elapsed: int,
    expected: int,
):
    assert clamp_reported_seconds(facts, reported, at(elapsed)) == expected


def test_a_negative_reported_time_becomes_zero(facts: RunningSessionFacts):
    assert clamp_reported_seconds(facts, -5, at(100)) == 0


def test_the_time_shown_to_others_is_the_clients_count_while_paused_and_the_servers_count_while_running(
    facts: RunningSessionFacts,
):
    running = replace(facts, last_interaction_actual_seconds=1800)
    paused = replace(facts, paused_at=at(2000), last_interaction_actual_seconds=1800)
    paused_without_count = replace(facts, paused_at=at(2000))

    assert current_worked_seconds(running, at(2500)) == 2500
    assert current_worked_seconds(paused, at(9000)) == 1800
    assert current_worked_seconds(paused_without_count, at(9000)) == 2000


def test_a_check_in_can_be_confirmed_a_little_before_it_is_due_until_its_deadline(facts: RunningSessionFacts):
    assert not checkin_can_be_confirmed(facts, at(3539))
    assert checkin_can_be_confirmed(facts, at(3540))
    assert checkin_can_be_confirmed(facts, at(3600))
    assert checkin_can_be_confirmed(facts, at(3900))
    assert not checkin_can_be_confirmed(facts, at(3901))


def test_a_paused_session_has_no_check_in_to_confirm(facts: RunningSessionFacts):
    assert not checkin_can_be_confirmed(replace(facts, paused_at=at(3000)), at(3600))
