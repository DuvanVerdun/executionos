from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo


Period = Literal["week", "month", "year", "all_time"]


@dataclass(frozen=True)
class PeriodBounds:
    start_utc: datetime | None
    end_utc: datetime
    start_date: date | None
    end_date: date


def as_utc_aware(value: datetime) -> datetime:
    """
    ExecutionOS currently stores Session.date as UTC.

    SQLite/Turso may return that value as a naive datetime, so a naive value
    here is interpreted as UTC.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)

    return value.astimezone(UTC)


def utc_iso(value: datetime) -> str:
    """Naive UTC ISO 8601 with milliseconds. The client appends the Z."""
    return as_utc_aware(value).replace(tzinfo=None).isoformat(timespec="milliseconds")


def local_day_start_as_utc_naive(
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
            end_utc=local_day_start_as_utc_naive(
                end_exclusive_date,
                timezone,
            ),
            start_date=None,
            end_date=anchor_date,
        )

    return PeriodBounds(
        start_utc=local_day_start_as_utc_naive(start_date, timezone),
        end_utc=local_day_start_as_utc_naive(
            end_exclusive_date,
            timezone,
        ),
        start_date=start_date,
        end_date=end_exclusive_date - timedelta(days=1),
    )
