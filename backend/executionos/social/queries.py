"""What the profiles and the list of people you follow look like to the user who asks. Reads only."""
from datetime import UTC, datetime, timedelta
from typing import Any, cast
from zoneinfo import ZoneInfo

from sqlalchemy import and_, func, select

from executionos.dashboard.streak import best_streak, calculate_streak_states, get_work_dates_for_users
from executionos.extensions import db
from executionos.models import Block, Follow, Presence, Session, User
from executionos.rooms.session_service import finalize_overdue_for_users, finalize_quietly
from executionos.sessions.history import session_local_date
from executionos.social.errors import UserNotAvailableError
from executionos.social.rules import (
    PresenceFacts,
    ReportedState,
    live_state,
    live_worked_seconds,
    ring_percentage,
)
from executionos.social.service import ACCEPTED, PENDING, find_available_user
from executionos.timeutils import as_utc_aware, local_day_start_as_utc_naive, utc_iso


HEATMAP_WEEKS = 26
STATS_DAYS = 30
SEARCH_MIN_LENGTH = 2
SEARCH_LIMIT = 10

_STATE_ORDER = {"working": 0, "paused": 1, "not_working": 2}


def _live_payload(presence: Presence | None, now: datetime) -> dict[str, Any]:
    """What others see of a user's session. Nothing but the state while the user is not working."""
    facts = None if presence is None else PresenceFacts(
        state=cast(ReportedState, presence.state),
        mission=presence.mission,
        worked_seconds=presence.worked_seconds,
        target_seconds=presence.target_seconds,
        reported_at=as_utc_aware(presence.reported_at),
    )
    state = live_state(facts, now)

    if facts is None or state == "not_working":
        return {"state": "not_working", "percentage": None, "mission": None, "worked_seconds": None, "target_seconds": None}

    return {
        "state": state,
        "percentage": ring_percentage(facts, now),
        "mission": facts.mission,
        "worked_seconds": live_worked_seconds(facts, now),
        "target_seconds": facts.target_seconds,
    }


def _load_presences(user_ids: list[int]) -> dict[int, Presence]:
    rows = db.session.execute(select(Presence).where(Presence.user_id.in_(user_ids))).scalars()
    return {presence.user_id: presence for presence in rows}


def get_following_for_user(user_id: int, timezone: ZoneInfo) -> dict[str, Any]:
    """The requests waiting for the user, and the people they follow: working first, then paused, then the rest."""
    now = datetime.now(UTC)
    today = now.astimezone(timezone).date()

    requests = db.session.execute(
        select(User.username)
        .join(Follow, Follow.follower_id == User.id)
        .where(Follow.followee_id == user_id, Follow.status == PENDING)
        .order_by(Follow.created_at.desc(), Follow.id.desc())
    ).scalars()

    followed = db.session.execute(
        select(User.id, User.username)
        .join(Follow, Follow.followee_id == User.id)
        .where(Follow.follower_id == user_id, Follow.status == ACCEPTED)
    ).all()
    followed_ids = [followed_id for followed_id, _ in followed]

    finalize_quietly(lambda: finalize_overdue_for_users(followed_ids))
    presences = _load_presences(followed_ids)
    work_dates = get_work_dates_for_users(followed_ids, timezone)

    following: list[dict[str, Any]] = [
        {
            "username": username,
            "streak": calculate_streak_states(work_dates[followed_id], today)[0],
            "live": _live_payload(presences.get(followed_id), now),
        }
        for followed_id, username in followed
    ]
    following.sort(key=lambda entry: (_STATE_ORDER[entry["live"]["state"]], entry["username"]))

    return {"requests": [{"username": username} for username in requests], "following": following}


def _count_follows(column: Any, user_id: int) -> int:
    return db.session.execute(
        select(func.count()).select_from(Follow).where(column == user_id, Follow.status == ACCEPTED)
    ).scalar_one()


def _build_data(user_id: int, timezone: ZoneInfo, now: datetime) -> dict[str, Any]:
    today = now.astimezone(timezone).date()
    work_dates = get_work_dates_for_users([user_id], timezone)[user_id]
    current_streak, _, states = calculate_streak_states(work_dates, today)

    first_day = today - timedelta(days=today.weekday()) - timedelta(weeks=HEATMAP_WEEKS - 1)
    days = [first_day + timedelta(days=offset) for offset in range(HEATMAP_WEEKS * 7)]

    stats_start = local_day_start_as_utc_naive(today - timedelta(days=STATS_DAYS - 1), timezone)
    recent = list(db.session.execute(
        select(Session).where(Session.user_id == user_id, Session.date >= stats_start)
    ).scalars())
    total_seconds = sum(session.actual_time_seconds for session in recent)

    last_activity = db.session.execute(
        select(func.max(Session.date)).where(Session.user_id == user_id)
    ).scalar_one_or_none()

    return {
        "live": _live_payload(_load_presences([user_id]).get(user_id), now),
        "last_activity_at": None if last_activity is None else utc_iso(last_activity),
        "streak": {"current": current_streak, "best": best_streak(states)},
        "heatmap": {
            "start_date": first_day.isoformat(),
            "states": ["neutral" if day > today else states.get(day, "neutral") for day in days],
        },
        "stats": {
            "total_time_seconds": total_seconds,
            "total_sessions": len(recent),
            "days_worked": len({session_local_date(session, timezone) for session in recent}),
            "average_session_time_seconds": round(total_seconds / len(recent)) if recent else None,
        },
    }


def get_profile_for_user(user_id: int, raw_username: str, timezone: ZoneInfo) -> dict[str, Any]:
    """A profile. Only its owner and the people who follow it see the data. Everyone else gets the card."""
    viewer = db.session.get(User, user_id)
    if viewer is None:
        raise UserNotAvailableError()

    is_you = raw_username.strip().lower() == viewer.username
    user = viewer if is_you else find_available_user(user_id, raw_username)

    status = None if is_you else db.session.execute(
        select(Follow.status).where(Follow.follower_id == user_id, Follow.followee_id == user.id)
    ).scalar_one_or_none()
    relation = "self" if is_you else {None: "none", ACCEPTED: "following", PENDING: "requested"}[status]
    follows_you = not is_you and db.session.execute(
        select(Follow.id).where(
            Follow.follower_id == user.id, Follow.followee_id == user_id, Follow.status == ACCEPTED
        )
    ).first() is not None

    can_view = relation in ("self", "following")
    if can_view:
        finalize_quietly(lambda: finalize_overdue_for_users([user.id]))

    return {
        "username": user.username,
        "is_private": user.is_private,
        "relation": relation,
        "follows_you": follows_you,
        "followers_count": _count_follows(Follow.followee_id, user.id),
        "following_count": _count_follows(Follow.follower_id, user.id),
        "data": _build_data(user.id, timezone, datetime.now(UTC)) if can_view else None,
    }


def search_users_for_user(user_id: int, raw_query: str) -> list[dict[str, Any]]:
    """Users whose username starts with the query. Nobody who blocked the user, or was blocked by them, shows up."""
    query = raw_query.strip().lower()
    if len(query) < SEARCH_MIN_LENGTH:
        return []

    rows = db.session.execute(
        select(User.username, User.is_private, Follow.status)
        .outerjoin(Follow, and_(Follow.follower_id == user_id, Follow.followee_id == User.id))
        .where(
            User.username.startswith(query, autoescape=True),
            User.id != user_id,
            User.id.not_in(select(Block.blocked_id).where(Block.blocker_id == user_id)),
            User.id.not_in(select(Block.blocker_id).where(Block.blocked_id == user_id)),
        )
        .order_by(User.username)
        .limit(SEARCH_LIMIT)
    ).all()

    return [
        {
            "username": username,
            "is_private": is_private,
            "relation": {None: "none", ACCEPTED: "following", PENDING: "requested"}[status],
        }
        for username, is_private, status in rows
    ]
