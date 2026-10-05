from calendar import monthrange
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any, Literal, cast
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import and_, or_, select

from extensions import db
from models import Session


Period = Literal["week", "month", "year", "all_time"]
CalendarState = Literal["work", "rest", "missed", "neutral"]


@dataclass(frozen=True)
class PeriodBounds:
    start_utc: datetime | None
    end_utc: datetime
    start_date: date | None
    end_date: date


@dataclass
class SessionSummaryAccumulator:
    total_time_seconds: int = 0
    total_sessions: int = 0
    completion_sum: float = 0.0


def parse_period(raw_period: str | None) -> Period:
    if raw_period not in ("week", "month", "year", "all_time"):
        raise ValueError("Invalid period")

    return cast(Period, raw_period)


def parse_anchor_date(raw_anchor_date: str | None) -> date:
    if raw_anchor_date is None:
        raise ValueError("anchor_date is required")

    try:
        return date.fromisoformat(raw_anchor_date)
    except ValueError as exc:
        raise ValueError("Invalid anchor_date") from exc


def parse_timezone(raw_timezone: str | None) -> ZoneInfo:
    if raw_timezone is None:
        raise ValueError("timezone is required")

    try:
        return ZoneInfo(raw_timezone)
    except ZoneInfoNotFoundError as exc:
        raise ValueError("Invalid timezone") from exc


def parse_cursor_datetime(raw_cursor_date: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(raw_cursor_date.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("Invalid cursor_date") from exc

    if parsed.tzinfo is None:
        return parsed

    return parsed.astimezone(UTC).replace(tzinfo=None)


def _as_utc_aware(value: datetime) -> datetime:
    """
    ExecutionOS currently stores Session.date as UTC.

    SQLite/Turso may return that value as a naive datetime, so a naive value
    here is interpreted as UTC.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)

    return value.astimezone(UTC)


def _local_day_start_as_utc_naive(
    local_day: date,
    timezone: ZoneInfo,
) -> datetime:
    local_start = datetime(
        local_day.year,
        local_day.month,
        local_day.day,
        tzinfo=timezone,
    )

    return local_start.astimezone(UTC).replace(tzinfo=None)


def get_period_bounds(
    period: Period,
    anchor_date: date,
    timezone: ZoneInfo,
) -> PeriodBounds:
    if period == "week":
        start_date = anchor_date - timedelta(days=anchor_date.weekday())
        end_exclusive_date = start_date + timedelta(days=7)

    elif period == "month":
        start_date = date(anchor_date.year, anchor_date.month, 1)

        if anchor_date.month == 12:
            end_exclusive_date = date(anchor_date.year + 1, 1, 1)
        else:
            end_exclusive_date = date(
                anchor_date.year,
                anchor_date.month + 1,
                1,
            )

    elif period == "year":
        start_date = date(anchor_date.year, 1, 1)
        end_exclusive_date = date(anchor_date.year + 1, 1, 1)

    else:
        end_exclusive_date = anchor_date + timedelta(days=1)

        return PeriodBounds(
            start_utc=None,
            end_utc=_local_day_start_as_utc_naive(
                end_exclusive_date,
                timezone,
            ),
            start_date=None,
            end_date=anchor_date,
        )

    return PeriodBounds(
        start_utc=_local_day_start_as_utc_naive(start_date, timezone),
        end_utc=_local_day_start_as_utc_naive(
            end_exclusive_date,
            timezone,
        ),
        start_date=start_date,
        end_date=end_exclusive_date - timedelta(days=1),
    )


def _session_completion_percentage(session: Session) -> float:
    if session.target_time_seconds <= 0:
        return 0.0

    return (
        session.actual_time_seconds
        / session.target_time_seconds
        * 100
    )


def _session_local_date(
    session: Session,
    timezone: ZoneInfo,
) -> date:
    return _as_utc_aware(session.date).astimezone(timezone).date()


def _serialize_session(session: Session) -> dict[str, Any]:
    completion_percentage = round(
        _session_completion_percentage(session),
        1,
    )

    utc_date = _as_utc_aware(session.date).replace(tzinfo=None)

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
        _session_local_date(session, timezone)
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
    local_date = _session_local_date(session, timezone)

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
            _session_completion_percentage(session)
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
                _session_completion_percentage(session)
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


def _build_daily_summaries_for_page(
    user_id: int,
    page: list[Session],
    timezone: ZoneInfo,
) -> dict[str, dict[str, Any]]:
    if not page:
        return {}

    represented_dates = {
        _session_local_date(session, timezone)
        for session in page
    }

    first_date = min(represented_dates)
    last_date = max(represented_dates)

    start_utc = _local_day_start_as_utc_naive(
        first_date,
        timezone,
    )

    end_utc = _local_day_start_as_utc_naive(
        last_date + timedelta(days=1),
        timezone,
    )

    statement = (
        select(Session)
        .where(
            Session.user_id == user_id,
            Session.date >= start_utc,
            Session.date < end_utc,
        )
        .order_by(Session.date.asc(), Session.id.asc())
    )

    sessions = list(
        db.session.execute(statement).scalars().all()
    )

    accumulators = {
        local_date: SessionSummaryAccumulator()
        for local_date in represented_dates
    }

    for session in sessions:
        local_date = _session_local_date(
            session,
            timezone,
        )

        accumulator = accumulators.get(local_date)

        if accumulator is None:
            continue

        accumulator.total_sessions += 1
        accumulator.total_time_seconds += (
            session.actual_time_seconds
        )
        accumulator.completion_sum += (
            _session_completion_percentage(session)
        )

    summaries: dict[str, dict[str, Any]] = {}

    for local_date, accumulator in accumulators.items():
        if accumulator.total_sessions == 0:
            continue

        summaries[local_date.isoformat()] = {
            "total_sessions": accumulator.total_sessions,
            "total_time_seconds": accumulator.total_time_seconds,
            "average_completion_percentage": round(
                accumulator.completion_sum
                / accumulator.total_sessions,
                1,
            ),
            "average_session_time_seconds": round(
                accumulator.total_time_seconds
                / accumulator.total_sessions
            ),
        }

    return summaries


def get_paginated_sessions(
    user_id: int,
    period: Period,
    anchor_date: date,
    timezone: ZoneInfo,
    cursor_date: datetime | None,
    cursor_id: int | None,
) -> dict[str, Any]:
    bounds = get_period_bounds(
        period,
        anchor_date,
        timezone,
    )

    statement = select(Session).where(
        Session.user_id == user_id,
        Session.date < bounds.end_utc,
    )

    if bounds.start_utc is not None:
        statement = statement.where(
            Session.date >= bounds.start_utc
        )

    if cursor_date is not None and cursor_id is not None:
        statement = statement.where(
            or_(
                Session.date < cursor_date,
                and_(
                    Session.date == cursor_date,
                    Session.id < cursor_id,
                ),
            )
        )

    statement = statement.order_by(
        Session.date.desc(),
        Session.id.desc(),
    ).limit(21)

    sessions = list(
        db.session.execute(statement).scalars().all()
    )

    has_more = len(sessions) > 20
    page = sessions[:20]

    next_cursor: dict[str, Any] | None = None

    if has_more and page:
        last_session = page[-1]

        cursor_utc = _as_utc_aware(
            last_session.date
        ).replace(tzinfo=None)

        next_cursor = {
            "date": cursor_utc.isoformat(),
            "id": last_session.id,
        }

    return {
        "sessions": [
            _serialize_session(session)
            for session in page
        ],
        "daily_summaries": _build_daily_summaries_for_page(
            user_id=user_id,
            page=page,
            timezone=timezone,
        ),
        "next_cursor": next_cursor,
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
        _session_local_date(session, timezone)
        for session in sessions
        if session.actual_time_seconds > 0
        and _session_local_date(session, timezone) <= today
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