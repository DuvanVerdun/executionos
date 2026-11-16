"""Pure rules for the live state of a user. No database and no clock: every input is passed in."""
import math
from dataclasses import dataclass
from datetime import datetime
from typing import Literal


PRESENCE_TIMEOUT_SECONDS = 180

ReportedState = Literal["working", "paused"]
LiveState = Literal["not_working", "working", "paused"]


@dataclass(frozen=True)
class PresenceFacts:
    """The last report of a client. The datetime is timezone-aware UTC."""
    state: ReportedState
    mission: str | None
    worked_seconds: int
    target_seconds: int
    reported_at: datetime


def live_state(facts: PresenceFacts | None, now: datetime) -> LiveState:
    """The state to show to others. A report older than the timeout means the client is gone."""
    if facts is None or (now - facts.reported_at).total_seconds() > PRESENCE_TIMEOUT_SECONDS:
        return "not_working"

    return facts.state


def live_worked_seconds(facts: PresenceFacts, now: datetime) -> int:
    """The time worked to show to others. While working, the time since the report is added to it."""
    if facts.state == "paused":
        return facts.worked_seconds

    return facts.worked_seconds + max(0, math.floor((now - facts.reported_at).total_seconds()))


def ring_percentage(facts: PresenceFacts, now: datetime) -> int:
    """How far the session has got, at most 100."""
    return min(100, math.floor(live_worked_seconds(facts, now) / facts.target_seconds * 100))
