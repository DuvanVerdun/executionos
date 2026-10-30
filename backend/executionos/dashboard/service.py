from calendar import monthrange
from datetime import UTC, date, datetime, timedelta
from typing import Any, Literal
from zoneinfo import ZoneInfo

from sqlalchemy import select

from executionos.extensions import db
from executionos.models import Session
from executionos.sessions.history import SessionSummaryAccumulator, session_completion_percentage, session_local_date
from executionos.timeutils import Period, PeriodBounds, get_period_bounds


CalendarState = Literal["work", "rest", "missed", "neutral"]


def _get_sessions_for_period(
    user_id: int,
    bounds: PeriodBounds,
) -> list[Session]:
    statement = select(Session).where(
        Session.user_id == user_id,
        Session.date < bounds.end_utc,
    )

    if bounds.start_utc is not None:
        statement = statement.where(Session.date >= bounds.start_utc)

    statement = statement.order_by(
        Session.date.asc(),
        Session.id.asc(),
    )

    return list(db.session.execute(statement).scalars().all())


def _increment_month(month_date: date) -> date:
    if month_date.month == 12:
        return date(month_date.year + 1, 1, 1)

    return date(month_date.year, month_date.month + 1, 1)


def _get_trend_bucket_starts(
    period: Period,
    anchor_date: date,
    bounds: PeriodBounds,
    sessions: list[Session],
    timezone: ZoneInfo,
) -> list[date]:
    if period == "week":
        if bounds.start_date is None:
            return []

        return [
            bounds.start_date + timedelta(days=offset)
            for offset in range(7)
        ]

    if period == "month":
        if bounds.start_date is None:
            return []

        number_of_days = monthrange(
            bounds.start_date.year,
            bounds.start_date.month,
        )[1]

        return [
            bounds.start_date + timedelta(days=offset)
            for offset in range(number_of_days)
        ]

    if period == "year":
        return [
            date(anchor_date.year, month, 1)
            for month in range(1, 13)
        ]

    if not sessions:
        return []

    first_session_date = min(
        session_local_date(session, timezone)
        for session in sessions
    )

    current_month = date(
        first_session_date.year,
        first_session_date.month,
        1,
    )
    final_month = date(anchor_date.year, anchor_date.month, 1)

    buckets: list[date] = []

    while current_month <= final_month:
        buckets.append(current_month)
        current_month = _increment_month(current_month)

    return buckets


def _get_session_bucket(
    session: Session,
    period: Period,
    timezone: ZoneInfo,
) -> date:
    local_date = session_local_date(session, timezone)

    if period in ("week", "month"):
        return local_date

    return date(local_date.year, local_date.month, 1)


def _build_trend(
    sessions: list[Session],
    period: Period,
    anchor_date: date,
    bounds: PeriodBounds,
    timezone: ZoneInfo,
) -> list[dict[str, Any]]:
    bucket_starts = _get_trend_bucket_starts(
        period,
        anchor_date,
        bounds,
        sessions,
        timezone,
    )

    accumulators = {
        bucket_start: SessionSummaryAccumulator()
        for bucket_start in bucket_starts
    }

    for session in sessions:
        bucket_start = _get_session_bucket(
            session,
            period,
            timezone,
        )

        accumulator = accumulators.get(bucket_start)

        if accumulator is None:
            continue

        accumulator.total_time_seconds += session.actual_time_seconds
        accumulator.total_sessions += 1
        accumulator.completion_sum += (
            session_completion_percentage(session)
        )

    trend: list[dict[str, Any]] = []

    for bucket_start in bucket_starts:
        accumulator = accumulators[bucket_start]

        average_completion: float | None = None

        if accumulator.total_sessions > 0:
            average_completion = round(
                accumulator.completion_sum
                / accumulator.total_sessions,
                1,
            )

        trend.append({
            "bucket_start": bucket_start.isoformat(),
            "total_time_seconds": accumulator.total_time_seconds,
            "total_sessions": accumulator.total_sessions,
            "average_completion_percentage": average_completion,
        })

    return trend


def get_dashboard_data(
    user_id: int,
    period: Period,
    anchor_date: date,
    timezone: ZoneInfo,
) -> dict[str, Any]:
    bounds = get_period_bounds(
        period,
        anchor_date,
        timezone,
    )

    sessions = _get_sessions_for_period(user_id, bounds)

    total_sessions = len(sessions)
    total_time_seconds = sum(
        session.actual_time_seconds
        for session in sessions
    )

    average_completion_percentage: float | None = None
    average_session_time_seconds: int | None = None

    if total_sessions > 0:
        average_completion_percentage = round(
            sum(
                session_completion_percentage(session)
                for session in sessions
            )
            / total_sessions,
            1,
        )

        average_session_time_seconds = round(
            total_time_seconds / total_sessions
        )

    return {
        "period": {
            "type": period,
            "anchor_date": anchor_date.isoformat(),
            "start_date": (
                bounds.start_date.isoformat()
                if bounds.start_date is not None
                else None
            ),
            "end_date": bounds.end_date.isoformat(),
        },
        "summary": {
            "total_time_seconds": total_time_seconds,
            "total_sessions": total_sessions,
            "average_completion_percentage": (
                average_completion_percentage
            ),
            "average_session_time_seconds": (
                average_session_time_seconds
            ),
        },
        "trend": _build_trend(
            sessions,
            period,
            anchor_date,
            bounds,
            timezone,
        ),
    }


def _calculate_streak_states(
    work_dates: set[date],
    today: date,
) -> tuple[int, int, dict[date, CalendarState]]:
    if not work_dates:
        return 0, 2, {}

    first_work_date = min(work_dates)

    states: dict[date, CalendarState] = {}

    current_streak = 0
    streak_active = False
    streak_has_started = False

    tracked_week_start: date | None = None
    rest_days_used = 0

    current_date = first_work_date

    while current_date <= today:
        current_week_start = (
            current_date
            - timedelta(days=current_date.weekday())
        )

        if tracked_week_start != current_week_start:
            tracked_week_start = current_week_start
            rest_days_used = 0

        if current_date in work_dates:
            if streak_active:
                current_streak += 1
            else:
                current_streak = 1
                streak_active = True

            streak_has_started = True
            states[current_date] = "work"

        elif current_date == today:
            states[current_date] = "neutral"

        elif not streak_has_started:
            states[current_date] = "neutral"

        elif streak_active and rest_days_used < 2:
            rest_days_used += 1
            states[current_date] = "rest"

        else:
            states[current_date] = "missed"
            streak_active = False
            current_streak = 0

        current_date += timedelta(days=1)

    rest_days_remaining = max(0, 2 - rest_days_used)
    
    return (
        current_streak,
        rest_days_remaining,
        states,
    )


def get_streak_data(
    user_id: int,
    anchor_date: date,
    timezone: ZoneInfo,
) -> dict[str, Any]:
    sessions = list(
        db.session.execute(
            select(Session)
            .where(Session.user_id == user_id)
            .order_by(Session.date.asc(), Session.id.asc())
        )
        .scalars()
        .all()
    )

    today = datetime.now(UTC).astimezone(timezone).date()

    work_dates = {
        session_local_date(session, timezone)
        for session in sessions
        if session.actual_time_seconds > 0
        and session_local_date(session, timezone) <= today
    }

    (
        current_streak,
        rest_days_remaining,
        states,
    ) = _calculate_streak_states(work_dates, today)

    calendar_start = date(
        anchor_date.year,
        anchor_date.month,
        1,
    )

    days_in_month = monthrange(
        anchor_date.year,
        anchor_date.month,
    )[1]

    calendar_days: list[dict[str, str]] = []

    for day_number in range(1, days_in_month + 1):
        calendar_date = date(
            anchor_date.year,
            anchor_date.month,
            day_number,
        )

        if calendar_date > today:
            state: CalendarState = "neutral"
        else:
            state = states.get(calendar_date, "neutral")

        calendar_days.append({
            "date": calendar_date.isoformat(),
            "state": state,
        })

    return {
        "current_streak": current_streak,
        "rest_days_remaining_this_week": rest_days_remaining,
        "calendar": {
            "month": calendar_start.strftime("%Y-%m"),
            "days": calendar_days,
        },
    }