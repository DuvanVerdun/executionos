from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import and_, func, select

from executionos.extensions import db
from executionos.models import Room, RoomMembership, Session, User
from executionos.rooms.rules import actual_time_seconds, member_state, ring_percentage
from executionos.rooms.service import get_active_membership, load_live_facts
from executionos.sessions.history import PAGE_SIZE, apply_cursor, daily_summaries, next_cursor, serialize_session


def _load_user_totals(room_id: int) -> dict[int, tuple[int, int]]:
    """Per user in this room: (sessions count, total seconds). Includes former members."""
    rows = db.session.execute(
        select(Session.user_id, func.count(), func.sum(Session.actual_time_seconds))
        .where(Session.room_id == room_id)
        .group_by(Session.user_id)
    ).tuples().all()

    return {uid: (int(count), int(seconds or 0)) for uid, count, seconds in rows}


def _build_summary(
    members_count: int,
    totals: dict[int, tuple[int, int]],
    running_seconds: int | None = None,
) -> dict[str, Any]:
    total_sessions = sum(count for count, _ in totals.values())
    total_time_seconds = sum(seconds for _, seconds in totals.values())

    if running_seconds is not None:
        total_sessions += 1
        total_time_seconds += running_seconds

    return {
        "total_time_seconds": total_time_seconds,
        "total_sessions": total_sessions,
        "members_count": members_count,
        "average_session_time_seconds": (
            round(total_time_seconds / total_sessions) if total_sessions > 0 else None
        ),
    }


def get_room_snapshot_for_user(user_id: int, room_id: int) -> dict[str, Any]:
    membership = get_active_membership(room_id, user_id)

    room = db.session.execute(
        select(Room).where(Room.id == room_id)
    ).scalar_one()

    member_rows = db.session.execute(
        select(RoomMembership.user_id, User.username)
        .join(User, User.id == RoomMembership.user_id)
        .where(
            RoomMembership.room_id == room_id,
            RoomMembership.left_at.is_(None),
        )
        .order_by(RoomMembership.joined_at.asc(), RoomMembership.id.asc())
    ).tuples().all()

    totals = _load_user_totals(room_id)
    owner_user_id = member_rows[0][0]

    now = datetime.now(UTC)
    live = {item.user_id: item for item in load_live_facts([room_id], now)}

    # sorted() is stable, so ties keep the join order from the query above.
    ranked = sorted(member_rows, key=lambda row: -totals.get(row[0], (0, 0))[1])

    ranking: list[dict[str, Any]] = []

    for position, (member_user_id, username) in enumerate(ranked, start=1):
        sessions_count, total_time_seconds = totals.get(member_user_id, (0, 0))
        facts = live.get(member_user_id)
        state = member_state(facts)

        ranking.append({
            "position": position,
            "username": username,
            "is_you": member_user_id == user_id,
            "is_owner": member_user_id == owner_user_id,
            "state": state,
            "ring_percentage": (
                ring_percentage(facts, now)
                if facts is not None and state == "working"
                else None
            ),
            "total_time_seconds": total_time_seconds,
            "sessions_count": sessions_count,
        })

    return {
        "room": {
            "id": room.id,
            "name": room.name,
            "is_owner": owner_user_id == user_id,
            "show_missions": membership.show_missions,
        },
        "summary": _build_summary(len(member_rows), totals),
        "ranking": ranking,
    }


def get_room_summary_for_user(
    user_id: int,
    room_id: int,
    include_my_running_session: bool = False,
) -> dict[str, Any]:
    get_active_membership(room_id, user_id)

    running_seconds: int | None = None

    if include_my_running_session:
        now = datetime.now(UTC)
        mine = load_live_facts([room_id], now, user_id)

        if mine:
            running_seconds = actual_time_seconds(mine[0], now)

    members_count = db.session.execute(
        select(func.count())
        .select_from(RoomMembership)
        .where(
            RoomMembership.room_id == room_id,
            RoomMembership.left_at.is_(None),
        )
    ).scalar_one()

    return _build_summary(members_count, _load_user_totals(room_id), running_seconds)


def get_room_sessions_for_user(
    user_id: int,
    room_id: int,
    timezone: ZoneInfo,
    cursor_date: datetime | None,
    cursor_id: int | None,
) -> dict[str, Any]:
    get_active_membership(room_id, user_id)

    statement = (
        select(Session, User.username, RoomMembership.show_missions, RoomMembership.left_at)
        .join(User, User.id == Session.user_id)
        .join(
            RoomMembership,
            and_(
                RoomMembership.room_id == Session.room_id,
                RoomMembership.user_id == Session.user_id,
            ),
        )
        .where(Session.room_id == room_id)
    )

    statement = apply_cursor(statement, cursor_date, cursor_id)

    rows = db.session.execute(
        statement.order_by(Session.date.desc(), Session.id.desc())
        .limit(PAGE_SIZE + 1)
    ).tuples().all()

    has_more = len(rows) > PAGE_SIZE
    page = rows[:PAGE_SIZE]

    sessions: list[dict[str, Any]] = []

    for session, username, show_missions, left_at in page:
        is_mine = session.user_id == user_id
        mission_hidden = not is_mine and not show_missions

        item = serialize_session(session)
        item.update({
            "mission": None if mission_hidden else session.mission,
            "mission_hidden": mission_hidden,
            "username": username,
            "is_mine": is_mine,
            "is_former_member": left_at is not None,
        })
        sessions.append(item)

    return {
        "sessions": sessions,
        "daily_summaries": daily_summaries([row[0] for row in page], timezone, Session.room_id == room_id),
        "next_cursor": next_cursor([row[0] for row in page], has_more),
    }
