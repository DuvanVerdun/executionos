from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import select

from executionos.extensions import db
from executionos.models import Session
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
