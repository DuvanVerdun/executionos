"""Storing what a client reports about its own session. The server never decides anything from it."""
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete
from sqlalchemy.dialects.sqlite import insert

from executionos.extensions import db
from executionos.models import Presence
from executionos.params import parse_mission
from executionos.social.rules import ReportedState


MAX_REPORTED_SECONDS = 100 * 3600


def _parse_state(raw_state: object) -> ReportedState:
    if raw_state == "working":
        return "working"
    if raw_state == "paused":
        return "paused"
    raise ValueError("State must be working or paused")


def _parse_seconds(raw_seconds: object, minimum: int) -> int:
    if (
        isinstance(raw_seconds, bool)
        or not isinstance(raw_seconds, int)
        or not minimum <= raw_seconds <= MAX_REPORTED_SECONDS
    ):
        raise ValueError("Seconds must be an integer in range")

    return raw_seconds


def report_presence_for_user(user_id: int, data: dict[str, Any]) -> None:
    """Replace the user's last report with this one."""
    values: dict[str, Any] = {
        "state": _parse_state(data.get("state")),
        "mission": parse_mission(data.get("mission")),
        "worked_seconds": _parse_seconds(data.get("workedSeconds"), 0),
        "target_seconds": _parse_seconds(data.get("targetSeconds"), 1),
        "reported_at": datetime.now(UTC),
    }
    statement = insert(Presence).values(user_id=user_id, **values)
    db.session.execute(statement.on_conflict_do_update(index_elements=[Presence.user_id], set_=values))
    db.session.commit()


def clear_presence_for_user(user_id: int) -> None:
    """Forget the user's last report, because their session ended."""
    db.session.execute(delete(Presence).where(Presence.user_id == user_id))
    db.session.commit()
