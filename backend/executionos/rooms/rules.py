"""Pure rules for room sessions. No database and no clock: every input is passed in."""
import math
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal


HEARTBEAT_TIMEOUT_SECONDS = 180
PAUSED_TIMEOUT_SECONDS = 3600
CHECKIN_INTERVAL_SECONDS = 3600
CHECKIN_RESPONSE_SECONDS = 300

# The client counts the time worked on its own clock. The server accepts that number, but never more than its own
# elapsed time plus this margin, which also covers the delay of the request that carries it.
REPORTED_TIME_TOLERANCE_SECONDS = 10

# The client opens the check-in at the moment its own count reaches the hour. The server accepts a check-in
# confirmed a little before its own count gets there.
CHECKIN_EARLY_TOLERANCE_SECONDS = 60

OverdueReason = Literal["disconnected", "missed_checkin", "paused_timeout"]
MemberState = Literal["not_working", "working", "paused"]


@dataclass(frozen=True)
class RunningSessionFacts:
    """Plain values of a running room session. All datetimes are timezone-aware UTC."""
    id: int
    user_id: int
    room_id: int
    submission_id: str
    mission: str
    target_time_seconds: int
    started_at: datetime
    paused_at: datetime | None
    paused_seconds: float
    last_checkin_mark: int
    last_interaction_at: datetime | None
    last_interaction_actual_seconds: int | None
    last_heartbeat_at: datetime


def actual_time_seconds(facts: RunningSessionFacts, now: datetime) -> int:
    """Time worked so far. Frozen at the pause moment while paused."""
    end = now if facts.paused_at is None else facts.paused_at
    elapsed = (end - facts.started_at).total_seconds() - facts.paused_seconds
    return max(0, math.floor(elapsed))


def clamp_reported_seconds(facts: RunningSessionFacts, reported_seconds: int, now: datetime) -> int:
    """The time worked that the client reported, kept between zero and the server's own elapsed time plus a margin."""
    elapsed = max(0, math.floor((now - facts.started_at).total_seconds()))
    return max(0, min(reported_seconds, elapsed + REPORTED_TIME_TOLERANCE_SECONDS))


def current_worked_seconds(facts: RunningSessionFacts, now: datetime) -> int:
    """The time worked to show to others. While paused it is the number the client reported at the pause."""
    if facts.paused_at is not None and facts.last_interaction_actual_seconds is not None:
        return facts.last_interaction_actual_seconds

    return actual_time_seconds(facts, now)


def checkin_due_at(facts: RunningSessionFacts) -> datetime:
    """When the next check-in becomes due (actual time 3600, 7200, ...)."""
    next_mark = facts.last_checkin_mark + 1
    return facts.started_at + timedelta(
        seconds=facts.paused_seconds + next_mark * CHECKIN_INTERVAL_SECONDS
    )


def checkin_deadline_at(facts: RunningSessionFacts) -> datetime:
    return checkin_due_at(facts) + timedelta(seconds=CHECKIN_RESPONSE_SECONDS)


def checkin_is_outstanding(facts: RunningSessionFacts, now: datetime) -> bool:
    """A check-in can only be due while the session is running."""
    return facts.paused_at is None and now >= checkin_due_at(facts)


def checkin_can_be_confirmed(facts: RunningSessionFacts, now: datetime) -> bool:
    """A check-in can be confirmed from a little before it is due until its deadline."""
    earliest = checkin_due_at(facts) - timedelta(seconds=CHECKIN_EARLY_TOLERANCE_SECONDS)

    return facts.paused_at is None and earliest <= now <= checkin_deadline_at(facts)


def overdue_reason(facts: RunningSessionFacts, now: datetime) -> OverdueReason | None:
    """Why the session is overdue, or None. The earliest expired deadline wins.

    Ties go in this order: disconnected, missed_checkin, paused_timeout.
    """
    candidates: list[tuple[datetime, int, OverdueReason]] = [
        (
            facts.last_heartbeat_at + timedelta(seconds=HEARTBEAT_TIMEOUT_SECONDS),
            0,
            "disconnected",
        )
    ]

    if facts.paused_at is not None:
        candidates.append((
            facts.paused_at + timedelta(seconds=PAUSED_TIMEOUT_SECONDS),
            2,
            "paused_timeout",
        ))
    else:
        candidates.append((checkin_deadline_at(facts), 1, "missed_checkin"))

    expired = [candidate for candidate in candidates if candidate[0] < now]

    if not expired:
        return None

    return min(expired)[2]


def saved_end_point(facts: RunningSessionFacts) -> tuple[datetime, int] | None:
    """Where an overdue session is saved, or None when nothing is saved.

    The end point is the last interaction (a pause or a successful check-in).
    """
    if facts.last_interaction_at is None or facts.last_interaction_actual_seconds is None:
        return None

    return facts.last_interaction_at, facts.last_interaction_actual_seconds


def member_state(facts: RunningSessionFacts | None) -> MemberState:
    if facts is None:
        return "not_working"

    return "working" if facts.paused_at is None else "paused"


def ring_percentage(facts: RunningSessionFacts, now: datetime) -> int:
    if facts.target_time_seconds <= 0:
        return 0

    actual = current_worked_seconds(facts, now)
    return min(100, math.floor(actual / facts.target_time_seconds * 100))
