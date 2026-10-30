from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any, TypeVar
from zoneinfo import ZoneInfo

from sqlalchemy import ColumnElement, Select, and_, or_, select

from executionos.extensions import db
from executionos.models import Session
from executionos.timeutils import as_utc_aware, local_day_start_as_utc_naive

PAGE_SIZE = 20

Row = TypeVar("Row", bound=tuple[Any, ...])


@dataclass
class SessionSummaryAccumulator:
    total_time_seconds: int = 0
    total_sessions: int = 0
    completion_sum: float = 0.0


def session_completion_percentage(session: Session) -> float:
    if session.target_time_seconds <= 0:
        return 0.0

    return (
        session.actual_time_seconds
        / session.target_time_seconds
        * 100
    )


def session_local_date(
    session: Session,
    timezone: ZoneInfo,
) -> date:
    return as_utc_aware(session.date).astimezone(timezone).date()


def serialize_session(session: Session) -> dict[str, Any]:
    completion_percentage = round(
        session_completion_percentage(session),
        1,
    )

    utc_date = as_utc_aware(session.date).replace(tzinfo=None)

    return {
        "id": session.id,
        "date": utc_date.isoformat(),
        "mission": session.mission,
        "target_time_seconds": session.target_time_seconds,
        "actual_time_seconds": session.actual_time_seconds,
        "percentage_completed": completion_percentage,
        "completion_status": (
            "completed"
            if session.actual_time_seconds >= session.target_time_seconds
            else "partial"
        ),
    }


def daily_summaries(
    page: list[Session],
    timezone: ZoneInfo,
    scope: ColumnElement[bool],
) -> dict[str, dict[str, Any]]:
    """Totals for each local day shown in the page, over every session in the scope on those days."""
    if not page:
        return {}

    represented_dates = {session_local_date(session, timezone) for session in page}

    start_utc = local_day_start_as_utc_naive(min(represented_dates), timezone)
    end_utc = local_day_start_as_utc_naive(
        max(represented_dates) + timedelta(days=1), timezone
    )

    sessions = db.session.execute(
        select(Session)
        .where(scope, Session.date >= start_utc, Session.date < end_utc)
        .order_by(Session.date.asc(), Session.id.asc())
    ).scalars().all()

    accumulators = {day: SessionSummaryAccumulator() for day in represented_dates}

    for session in sessions:
        accumulator = accumulators.get(session_local_date(session, timezone))

        if accumulator is None:
            continue

        accumulator.total_sessions += 1
        accumulator.total_time_seconds += session.actual_time_seconds
        accumulator.completion_sum += session_completion_percentage(session)

    return {
        day.isoformat(): {
            "total_sessions": accumulator.total_sessions,
            "total_time_seconds": accumulator.total_time_seconds,
            "average_completion_percentage": round(
                accumulator.completion_sum / accumulator.total_sessions, 1
            ),
            "average_session_time_seconds": round(
                accumulator.total_time_seconds / accumulator.total_sessions
            ),
        }
        for day, accumulator in accumulators.items()
        if accumulator.total_sessions > 0
    }


def apply_cursor(
    statement: Select[Row],
    cursor_date: datetime | None,
    cursor_id: int | None,
) -> Select[Row]:
    """Keep only the sessions that come after the cursor, newest first."""
    if cursor_date is None or cursor_id is None:
        return statement

    return statement.where(
        or_(
            Session.date < cursor_date,
            and_(Session.date == cursor_date, Session.id < cursor_id),
        )
    )


def next_cursor(page: list[Session], has_more: bool) -> dict[str, Any] | None:
    """Where the next page starts, or None on the last page."""
    if not has_more or not page:
        return None

    last_session = page[-1]

    return {
        "date": as_utc_aware(last_session.date).replace(tzinfo=None).isoformat(),
        "id": last_session.id,
    }
