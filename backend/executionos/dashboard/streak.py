from calendar import monthrange
from datetime import UTC, date, datetime, timedelta
from typing import Any, Literal
from zoneinfo import ZoneInfo

from sqlalchemy import select

from executionos.extensions import db
from executionos.models import Session
from executionos.sessions.history import session_local_date


CalendarState = Literal["work", "rest", "missed", "neutral"]


def calculate_streak_states(
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
    ) = calculate_streak_states(work_dates, today)

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
