import re
import secrets
from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import and_, delete, func, select, update
from sqlalchemy.exc import IntegrityError

from executionos.extensions import db
from executionos.models import ActiveRoomSession, Room, RoomMembership, Session, User
from executionos.sessions.history import PAGE_SIZE, apply_cursor, daily_summaries, next_cursor, serialize_session
from executionos.timeutils import as_utc_aware
from executionos.rooms.rules import (
    RunningSessionFacts,
    actual_time_seconds,
    member_state,
    overdue_reason,
    ring_percentage,
)


ROOM_NAME_MAX_LENGTH = 50
LINK_TOKEN_BYTES = 16
LINK_TOKEN_MAX_LENGTH = 64

_LINK_TOKEN_PATTERN = re.compile(r"[A-Za-z0-9_-]+")


class RoomNotAvailableError(Exception):
    """The room does not exist, or the user may not know about it."""


class RoomForbiddenError(Exception):
    """An active member tried an owner-only action."""


class RoomConflictError(Exception):
    """The action is not possible while a room session is running."""


def _validate_room_name(raw_name: object) -> str:
    if not isinstance(raw_name, str):
        raise ValueError("Room name must be a string")

    name = raw_name.strip()
    if not name or len(name) > ROOM_NAME_MAX_LENGTH:
        raise ValueError("Room name must be 1 to 50 characters")

    return name


def _validate_link_token(raw_token: object) -> str:
    if (
        not isinstance(raw_token, str)
        or len(raw_token) > LINK_TOKEN_MAX_LENGTH
        or _LINK_TOKEN_PATTERN.fullmatch(raw_token) is None
    ):
        raise ValueError("Invalid link token")

    return raw_token


def _generate_link_token() -> str:
    while True:
        token = secrets.token_urlsafe(LINK_TOKEN_BYTES)
        taken = db.session.execute(
            select(Room.id).where(Room.link_token == token)
        ).first()
        if taken is None:
            return token


def get_active_membership(room_id: int, user_id: int) -> RoomMembership:
    membership = db.session.execute(
        select(RoomMembership).where(
            RoomMembership.room_id == room_id,
            RoomMembership.user_id == user_id,
            RoomMembership.left_at.is_(None),
        )
    ).scalar_one_or_none()

    if membership is None:
        raise RoomNotAvailableError()

    return membership


def is_owner(room_id: int, user_id: int) -> bool:
    """The owner is the active member who joined first (ties: lowest id)."""
    owner_user_id = db.session.execute(
        select(RoomMembership.user_id)
        .where(
            RoomMembership.room_id == room_id,
            RoomMembership.left_at.is_(None),
        )
        .order_by(RoomMembership.joined_at.asc(), RoomMembership.id.asc())
        .limit(1)
    ).scalar_one_or_none()

    return owner_user_id == user_id


def _require_owner(room_id: int, user_id: int) -> None:
    get_active_membership(room_id, user_id)

    if not is_owner(room_id, user_id):
        raise RoomForbiddenError()


def running_session_facts(row: ActiveRoomSession) -> RunningSessionFacts:
    """Copy a running-session row into plain values, with timezone-aware UTC datetimes."""
    return RunningSessionFacts(
        id=row.id,
        user_id=row.user_id,
        room_id=row.room_id,
        submission_id=row.submission_id,
        mission=row.mission,
        target_time_seconds=row.target_time_seconds,
        started_at=as_utc_aware(row.started_at),
        paused_at=as_utc_aware(row.paused_at) if row.paused_at is not None else None,
        paused_seconds=row.paused_seconds,
        last_checkin_mark=row.last_checkin_mark,
        last_interaction_at=(
            as_utc_aware(row.last_interaction_at)
            if row.last_interaction_at is not None
            else None
        ),
        last_interaction_actual_seconds=row.last_interaction_actual_seconds,
        last_heartbeat_at=as_utc_aware(row.last_heartbeat_at),
    )


def _load_live_facts(
    room_ids: list[int],
    now: datetime,
    user_id: int | None = None,
) -> list[RunningSessionFacts]:
    """Running sessions in these rooms. An overdue session is never shown as live."""
    statement = select(ActiveRoomSession).where(ActiveRoomSession.room_id.in_(room_ids))

    if user_id is not None:
        statement = statement.where(ActiveRoomSession.user_id == user_id)

    rows = db.session.execute(statement).scalars().all()
    facts = [running_session_facts(row) for row in rows]

    return [item for item in facts if overdue_reason(item, now) is None]


def _has_running_session(room_id: int, user_id: int | None = None) -> bool:
    statement = select(ActiveRoomSession.id).where(ActiveRoomSession.room_id == room_id)

    if user_id is not None:
        statement = statement.where(ActiveRoomSession.user_id == user_id)

    return db.session.execute(statement.limit(1)).first() is not None


def _build_cards(
    user_id: int,
    rows: list[tuple[RoomMembership, Room]],
) -> list[dict[str, Any]]:
    """Build room cards with a fixed number of queries, however many rooms."""
    if not rows:
        return []

    room_ids = [room.id for _, room in rows]

    member_rows = db.session.execute(
        select(RoomMembership.room_id, RoomMembership.user_id)
        .where(
            RoomMembership.room_id.in_(room_ids),
            RoomMembership.left_at.is_(None),
        )
        .order_by(RoomMembership.joined_at.asc(), RoomMembership.id.asc())
    ).tuples().all()

    members_count: dict[int, int] = {}
    owner_user_ids: dict[int, int] = {}

    for member_room_id, member_user_id in member_rows:
        members_count[member_room_id] = members_count.get(member_room_id, 0) + 1
        owner_user_ids.setdefault(member_room_id, member_user_id)

    total_rows = db.session.execute(
        select(Session.room_id, func.sum(Session.actual_time_seconds))
        .where(
            Session.user_id == user_id,
            Session.room_id.in_(room_ids),
        )
        .group_by(Session.room_id)
    ).tuples().all()

    my_totals: dict[int, int] = {}

    for total_room_id, total_seconds in total_rows:
        if total_room_id is not None:
            my_totals[total_room_id] = int(total_seconds or 0)

    working_now_counts: dict[int, int] = {}

    for facts in _load_live_facts(room_ids, datetime.now(UTC)):
        if facts.paused_at is None:
            working_now_counts[facts.room_id] = working_now_counts.get(facts.room_id, 0) + 1

    return [
        {
            "id": room.id,
            "name": room.name,
            "members_count": members_count.get(room.id, 0),
            "my_total_time_seconds": my_totals.get(room.id, 0),
            "working_now_count": working_now_counts.get(room.id, 0),
            "is_owner": owner_user_ids.get(room.id) == user_id,
            "show_missions": membership.show_missions,
        }
        for membership, room in rows
    ]


def list_rooms_for_user(user_id: int) -> list[dict[str, Any]]:
    rows = db.session.execute(
        select(RoomMembership, Room)
        .join(Room, Room.id == RoomMembership.room_id)
        .where(
            RoomMembership.user_id == user_id,
            RoomMembership.left_at.is_(None),
        )
        .order_by(RoomMembership.joined_at.asc(), RoomMembership.id.asc())
    ).tuples().all()

    return _build_cards(user_id, list(rows))


def create_room_for_user(user_id: int, raw_name: object) -> dict[str, Any]:
    name = _validate_room_name(raw_name)
    now = datetime.now(UTC)

    room = Room(name=name, link_token=_generate_link_token(), created_at=now)
    db.session.add(room)
    db.session.flush()

    membership = RoomMembership(room_id=room.id, user_id=user_id, joined_at=now)
    db.session.add(membership)
    db.session.commit()

    card = _build_cards(user_id, [(membership, room)])[0]
    return {**card, "link_token": room.link_token}


def join_room_for_user(user_id: int, raw_token: object) -> dict[str, Any]:
    token = _validate_link_token(raw_token)

    room = db.session.execute(
        select(Room).where(Room.link_token == token)
    ).scalar_one_or_none()

    if room is None:
        raise RoomNotAvailableError()

    room_id = room.id
    now = datetime.now(UTC)

    membership = db.session.execute(
        select(RoomMembership).where(
            RoomMembership.room_id == room_id,
            RoomMembership.user_id == user_id,
        )
    ).scalar_one_or_none()

    already_member = membership is not None and membership.left_at is None

    if membership is None:
        membership = RoomMembership(room_id=room_id, user_id=user_id, joined_at=now)
        db.session.add(membership)
    elif membership.left_at is not None:
        membership.left_at = None
        membership.joined_at = now

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        membership = get_active_membership(room_id, user_id)
        already_member = True

    card = _build_cards(user_id, [(membership, room)])[0]
    return {**card, "already_member": already_member}


def _delete_room_records(room_id: int) -> None:
    """Delete a room in a safe order. The caller commits."""
    db.session.execute(
        update(Session).where(Session.room_id == room_id).values(room_id=None)
    )
    db.session.execute(
        delete(RoomMembership).where(RoomMembership.room_id == room_id)
    )
    db.session.execute(delete(Room).where(Room.id == room_id))


def leave_room_for_user(user_id: int, room_id: int) -> dict[str, Any]:
    membership = get_active_membership(room_id, user_id)

    if _has_running_session(room_id, user_id):
        raise RoomConflictError()

    membership.left_at = datetime.now(UTC)
    db.session.flush()

    remaining = db.session.execute(
        select(func.count())
        .select_from(RoomMembership)
        .where(
            RoomMembership.room_id == room_id,
            RoomMembership.left_at.is_(None),
        )
    ).scalar_one()

    room_deleted = remaining == 0
    if room_deleted:
        _delete_room_records(room_id)

    db.session.commit()
    return {"room_deleted": room_deleted}


def delete_room_for_user(user_id: int, room_id: int) -> None:
    _require_owner(room_id, user_id)

    if _has_running_session(room_id):
        raise RoomConflictError()

    _delete_room_records(room_id)
    db.session.commit()


def get_room_link_for_user(user_id: int, room_id: int) -> str:
    _require_owner(room_id, user_id)

    return db.session.execute(
        select(Room.link_token).where(Room.id == room_id)
    ).scalar_one()


def refresh_room_link_for_user(user_id: int, room_id: int) -> str:
    _require_owner(room_id, user_id)

    token = _generate_link_token()
    db.session.execute(
        update(Room).where(Room.id == room_id).values(link_token=token)
    )
    db.session.commit()
    return token


def set_show_missions_for_user(user_id: int, room_id: int, raw_value: object) -> bool:
    if not isinstance(raw_value, bool):
        raise ValueError("showMissions must be a boolean")

    membership = get_active_membership(room_id, user_id)
    membership.show_missions = raw_value
    db.session.commit()
    return raw_value


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
    live = {item.user_id: item for item in _load_live_facts([room_id], now)}

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
        mine = _load_live_facts([room_id], now, user_id)

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
