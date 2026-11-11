from datetime import UTC, date, datetime
from typing import Any, cast
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from flask import request  # type: ignore[attr-defined]

from executionos.timeutils import Period


MISSION_MAX_LENGTH = 200


def parse_mission(raw_mission: object) -> str:
    """A valid mission, without the spaces around it."""
    mission = raw_mission.strip() if isinstance(raw_mission, str) else ""
    if not mission or len(mission) > MISSION_MAX_LENGTH:
        raise ValueError(f"A mission of at most {MISSION_MAX_LENGTH} characters is required")
    return mission


def parse_period(raw_period: str | None) -> Period:
    if raw_period not in ("week", "month", "year", "all_time"):
        raise ValueError("Invalid period")

    return raw_period


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


def read_cursor() -> tuple[datetime | None, int | None]:
    """The paging cursor of this request: both values or neither."""
    raw_cursor_date = request.args.get("cursor_date")
    raw_cursor_id = request.args.get("cursor_id")

    if (raw_cursor_date is None) != (raw_cursor_id is None):
        raise ValueError("cursor_date and cursor_id must be provided together")

    if raw_cursor_date is None or raw_cursor_id is None:
        return None, None

    return parse_cursor_datetime(raw_cursor_date), int(raw_cursor_id)


def read_optional_json_object() -> dict[str, Any]:
    """The JSON object of this request, or an empty one when the request has no body."""
    raw_data: object = request.get_json(silent=True)  # type: ignore[reportUnknownMemberType]
    return cast(dict[str, Any], raw_data) if isinstance(raw_data, dict) else {}


def read_json_object() -> dict[str, Any]:
    raw_data: object = request.get_json(silent=True)  # type: ignore[reportUnknownMemberType]
    if not isinstance(raw_data, dict):
        raise ValueError("A JSON object is required")
    return cast(dict[str, Any], raw_data)
