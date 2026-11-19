from datetime import date, datetime
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from executionos.extensions import db
from executionos.models import Session
from executionos.params import parse_mission
from executionos.sessions.history import (
    PAGE_SIZE,
    apply_cursor,
    daily_summaries,
    next_cursor,
    serialize_session,
)
from executionos.timeutils import Period, get_period_bounds


def get_paginated_sessions(
    user_id: int,
    period: Period,
    anchor_date: date,
    timezone: ZoneInfo,
    cursor_date: datetime | None,
    cursor_id: int | None,
) -> dict[str, Any]:
    bounds = get_period_bounds(period, anchor_date, timezone)

    statement = select(Session).where(
        Session.user_id == user_id,
        Session.date < bounds.end_utc,
    )

    if bounds.start_utc is not None:
        statement = statement.where(Session.date >= bounds.start_utc)

    statement = apply_cursor(statement, cursor_date, cursor_id)

    sessions = list(
        db.session.execute(
            statement.order_by(Session.date.desc(), Session.id.desc()).limit(PAGE_SIZE + 1)
        ).scalars().all()
    )

    has_more = len(sessions) > PAGE_SIZE
    page = sessions[:PAGE_SIZE]

    return {
        "sessions": [serialize_session(session) for session in page],
        "daily_summaries": daily_summaries(page, timezone, Session.user_id == user_id),
        "next_cursor": next_cursor(page, has_more),
    }


def _find_by_submission(user_id: int, submission_id: str) -> Session | None:
    return db.session.execute(
        select(Session).filter_by(user_id=user_id, submission_id=submission_id)
    ).scalar_one_or_none()


def save_session_for_user(user_id: int, data: dict[str, Any]) -> tuple[Session, bool]:
    """Validate the session data and save it for the user.

    Returns the session and whether it was created. A repeated `submissionId` returns the session
    saved the first time. Raises ValueError, TypeError or KeyError when the data is invalid.
    """
    submission_id: str | None = None
    if data.get("submissionId") is not None:
        if not isinstance(data["submissionId"], str):
            raise ValueError("Submission ID must be a UUID string")
        submission_id = str(UUID(data["submissionId"]))
        existing = _find_by_submission(user_id, submission_id)
        if existing is not None:
            return existing, False

    mission = parse_mission(data["mission"])
    for field in ("targetTimeSeconds", "actualTimeSeconds"):
        value = data[field]
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise ValueError("Session times must be non-negative integers")
    if data["targetTimeSeconds"] == 0:
        raise ValueError("Target time must be greater than zero")
    if not isinstance(data["date"], str):
        raise ValueError("Session date must be an ISO string")

    new_session = Session(
        user_id=user_id,
        date=datetime.fromisoformat(data["date"].replace("Z", "+00:00")),
        mission=mission,
        target_time_seconds=int(data["targetTimeSeconds"]),
        actual_time_seconds=int(data["actualTimeSeconds"]),
    )
    new_session.submission_id = submission_id

    db.session.add(new_session)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        existing = None if submission_id is None else _find_by_submission(user_id, submission_id)
        if existing is None:
            raise
        return existing, False

    return new_session, True
