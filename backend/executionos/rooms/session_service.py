from collections.abc import Callable, Sequence
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from flask import current_app
from sqlalchemy import Select, delete, select
from sqlalchemy.exc import IntegrityError

from executionos.extensions import db
from executionos.models import ActiveRoomSession, Room, RoomMembership, Session, SessionEndNotice
from executionos.rooms.errors import RoomNotAvailableError, RoomSessionConflictError
from executionos.rooms.service import running_session_facts
from executionos.timeutils import utc_iso
from executionos.rooms.rules import (
    OverdueReason,
    RunningSessionFacts,
    actual_time_seconds,
    checkin_deadline_at,
    checkin_due_at,
    checkin_is_outstanding,
    overdue_reason,
    saved_end_point,
)


MISSION_MAX_LENGTH = 200

LoadedRow = tuple[ActiveRoomSession, str]


def _load_row(user_id: int) -> LoadedRow | None:
    """Load the user's running row together with its room name, in one query."""
    result = db.session.execute(
        select(ActiveRoomSession, Room.name)
        .join(Room, Room.id == ActiveRoomSession.room_id)
        .where(ActiveRoomSession.user_id == user_id)
    ).tuples().first()

    if result is None:
        return None

    return result[0], result[1]


# ---------- Finalization ----------

def _claim_row(facts: RunningSessionFacts) -> bool:
    """Win the right to finalize a row by deleting it. Only one request can win."""
    claimed = db.session.execute(
        delete(ActiveRoomSession)
        .where(
            ActiveRoomSession.id == facts.id,
            ActiveRoomSession.submission_id == facts.submission_id,
        )
        .returning(ActiveRoomSession.id)
    ).scalar_one_or_none()

    return claimed is not None


def _add_saved_session(
    facts: RunningSessionFacts,
    ended_at: datetime,
    actual_seconds: int,
) -> Session:
    session = Session(
        user_id=facts.user_id,
        date=ended_at,
        mission=facts.mission,
        target_time_seconds=facts.target_time_seconds,
        actual_time_seconds=actual_seconds,
    )
    session.room_id = facts.room_id
    session.submission_id = facts.submission_id
    db.session.add(session)
    return session


def _finalize_row(facts: RunningSessionFacts, reason: OverdueReason, now: datetime) -> None:
    """Close one overdue row in one transaction: claim, save or discard, leave a notice."""
    end_point = saved_end_point(facts)

    try:
        if not _claim_row(facts):
            db.session.rollback()
            return

        saved_seconds: int | None = None

        if end_point is not None:
            ended_at, saved_seconds = end_point
            _add_saved_session(facts, ended_at, saved_seconds)

        db.session.execute(
            delete(SessionEndNotice).where(SessionEndNotice.user_id == facts.user_id)
        )
        db.session.add(SessionEndNotice(
            user_id=facts.user_id,
            reason=reason,
            saved=end_point is not None,
            actual_time_seconds=saved_seconds,
            created_at=now,
        ))
        db.session.commit()
    except IntegrityError:
        # The session was already saved under this submission ID: only drop the row.
        db.session.rollback()
        _claim_row(facts)
        db.session.commit()


def _finalize_overdue(statement: Select[tuple[ActiveRoomSession]]) -> None:
    rows = db.session.execute(statement).scalars().all()
    candidates = [running_session_facts(row) for row in rows]
    now = datetime.now(UTC)

    for facts in candidates:
        reason = overdue_reason(facts, now)

        if reason is not None:
            _finalize_row(facts, reason, now)


def finalize_overdue_for_users(user_ids: Sequence[int]) -> None:
    if not user_ids:
        return

    _finalize_overdue(
        select(ActiveRoomSession).where(ActiveRoomSession.user_id.in_(user_ids))
    )


def finalize_overdue_for_rooms(room_ids: Sequence[int]) -> None:
    if not room_ids:
        return

    _finalize_overdue(
        select(ActiveRoomSession).where(ActiveRoomSession.room_id.in_(room_ids))
    )


def finalize_overdue_for_user_rooms(user_id: int) -> None:
    """Finalize every room the user is an active member of."""
    room_ids = db.session.execute(
        select(RoomMembership.room_id).where(
            RoomMembership.user_id == user_id,
            RoomMembership.left_at.is_(None),
        )
    ).scalars().all()

    finalize_overdue_for_rooms(list(room_ids))


def finalize_quietly(finalize: Callable[[], None]) -> None:
    """Finalize overdue room sessions on a read path. A failure is logged, never raised."""
    try:
        finalize()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Could not finalize overdue room sessions")


# ---------- Envelope ----------

def _consume_notice(user_id: int) -> dict[str, Any] | None:
    """Read and delete the user's pending notice. The caller commits."""
    notice = db.session.execute(
        select(SessionEndNotice).where(SessionEndNotice.user_id == user_id)
    ).scalar_one_or_none()

    if notice is None:
        return None

    payload: dict[str, Any] = {
        "reason": notice.reason,
        "saved": notice.saved,
        "actual_time_seconds": notice.actual_time_seconds,
    }
    db.session.delete(notice)
    return payload


def _session_payload(facts: RunningSessionFacts, room_name: str, now: datetime) -> dict[str, Any]:
    running = facts.paused_at is None

    return {
        "submission_id": facts.submission_id,
        "room_id": facts.room_id,
        "room_name": room_name,
        "mission": facts.mission,
        "target_time_seconds": facts.target_time_seconds,
        "started_at": utc_iso(facts.started_at),
        "paused_at": utc_iso(facts.paused_at) if facts.paused_at is not None else None,
        "paused_seconds": facts.paused_seconds,
        "actual_time_seconds": actual_time_seconds(facts, now),
        "state": "running" if running else "paused",
        "checkin": {
            "mark": facts.last_checkin_mark + 1,
            "due_at": utc_iso(checkin_due_at(facts)) if running else None,
            "deadline_at": utc_iso(checkin_deadline_at(facts)) if running else None,
            "outstanding": checkin_is_outstanding(facts, now),
        },
    }


def _respond(
    user_id: int,
    loaded: LoadedRow | None,
    now: datetime,
    conflict: bool = False,
    consume_notice: bool = True,
) -> dict[str, Any]:
    """Refresh the heartbeat, build the envelope, and commit.

    The pending notice is read only when asked to, or when no session is running,
    because a running session cannot have a notice waiting.
    """
    facts: RunningSessionFacts | None = None
    room_name = ""

    if loaded is not None:
        row, room_name = loaded
        row.last_heartbeat_at = now
        facts = running_session_facts(row)

    envelope: dict[str, Any] = {
        "success": True,
        "server_time": utc_iso(now),
        "active": facts is not None,
        "session": _session_payload(facts, room_name, now) if facts is not None else None,
        "notice": _consume_notice(user_id) if (consume_notice or facts is None) else None,
    }
    db.session.commit()

    if conflict:
        raise RoomSessionConflictError({**envelope, "success": False})

    return envelope


def _begin(user_id: int) -> tuple[datetime, LoadedRow | None]:
    """Load the user's row once. An overdue row is finalized and reported as missing."""
    now = datetime.now(UTC)
    loaded = _load_row(user_id)

    if loaded is None:
        return now, None

    facts = running_session_facts(loaded[0])
    reason = overdue_reason(facts, now)

    if reason is None:
        return now, loaded

    _finalize_row(facts, reason, now)
    return now, None


# ---------- Operations ----------

def get_room_session_for_user(user_id: int) -> dict[str, Any]:
    now, loaded = _begin(user_id)
    return _respond(user_id, loaded, now)


def heartbeat_room_session_for_user(user_id: int) -> dict[str, Any]:
    now, loaded = _begin(user_id)
    return _respond(user_id, loaded, now, consume_notice=False)


def _validate_start_input(
    raw_room_id: object,
    raw_mission: object,
    raw_target_time_seconds: object,
) -> tuple[int, str, int]:
    if isinstance(raw_room_id, bool) or not isinstance(raw_room_id, int):
        raise ValueError("Room ID must be an integer")

    if (
        not isinstance(raw_mission, str)
        or not raw_mission.strip()
        or len(raw_mission) > MISSION_MAX_LENGTH
    ):
        raise ValueError("A mission of at most 200 characters is required")

    if (
        isinstance(raw_target_time_seconds, bool)
        or not isinstance(raw_target_time_seconds, int)
        or raw_target_time_seconds <= 0
    ):
        raise ValueError("Target time must be a positive integer")

    return raw_room_id, raw_mission, raw_target_time_seconds


def _load_member_room_name(room_id: int, user_id: int) -> str:
    """Return the room's name if the user is an active member, in one query."""
    room_name = db.session.execute(
        select(Room.name)
        .join(RoomMembership, RoomMembership.room_id == Room.id)
        .where(
            Room.id == room_id,
            RoomMembership.user_id == user_id,
            RoomMembership.left_at.is_(None),
        )
    ).scalar_one_or_none()

    if room_name is None:
        raise RoomNotAvailableError()

    return room_name


def start_room_session_for_user(
    user_id: int,
    raw_room_id: object,
    raw_mission: object,
    raw_target_time_seconds: object,
) -> dict[str, Any]:
    room_id, mission, target_time_seconds = _validate_start_input(
        raw_room_id, raw_mission, raw_target_time_seconds
    )

    now, existing = _begin(user_id)
    room_name = _load_member_room_name(room_id, user_id)

    if existing is not None:
        return _respond(user_id, existing, now, conflict=True)

    row = ActiveRoomSession(
        user_id=user_id,
        room_id=room_id,
        submission_id=str(uuid4()),
        mission=mission,
        target_time_seconds=target_time_seconds,
        started_at=now,
    )
    db.session.add(row)

    try:
        db.session.flush()
    except IntegrityError:
        # A second Start arrived at the same moment (double click or second tab).
        db.session.rollback()
        return _respond(user_id, _load_row(user_id), now, conflict=True)

    return _respond(user_id, (row, room_name), now)


def pause_room_session_for_user(user_id: int) -> dict[str, Any]:
    now, loaded = _begin(user_id)

    if loaded is None:
        return _respond(user_id, None, now)

    row = loaded[0]
    facts = running_session_facts(row)

    if facts.paused_at is not None:
        return _respond(user_id, loaded, now, consume_notice=False)

    if checkin_is_outstanding(facts, now):
        return _respond(user_id, loaded, now, conflict=True, consume_notice=False)

    row.last_interaction_at = now
    row.last_interaction_actual_seconds = actual_time_seconds(facts, now)
    row.paused_at = now
    return _respond(user_id, loaded, now, consume_notice=False)


def resume_room_session_for_user(user_id: int) -> dict[str, Any]:
    now, loaded = _begin(user_id)

    if loaded is None:
        return _respond(user_id, None, now)

    row = loaded[0]
    facts = running_session_facts(row)

    if facts.paused_at is not None:
        row.paused_seconds = facts.paused_seconds + (now - facts.paused_at).total_seconds()
        row.paused_at = None

    return _respond(user_id, loaded, now, consume_notice=False)


def checkin_room_session_for_user(user_id: int) -> dict[str, Any]:
    now, loaded = _begin(user_id)

    if loaded is None:
        return _respond(user_id, None, now)

    row = loaded[0]
    facts = running_session_facts(row)

    if checkin_is_outstanding(facts, now) and now <= checkin_deadline_at(facts):
        row.last_checkin_mark = facts.last_checkin_mark + 1
        row.last_interaction_at = now
        row.last_interaction_actual_seconds = actual_time_seconds(facts, now)

    return _respond(user_id, loaded, now, consume_notice=False)


def _find_saved_session_id(user_id: int, submission_id: str) -> int | None:
    return db.session.execute(
        select(Session.id).where(
            Session.user_id == user_id,
            Session.submission_id == submission_id,
        )
    ).scalar_one_or_none()


def finish_room_session_for_user(user_id: int, raw_submission_id: object) -> dict[str, Any]:
    if not isinstance(raw_submission_id, str):
        raise ValueError("Submission ID must be a UUID string")

    submission_id = str(UUID(raw_submission_id))

    now, loaded = _begin(user_id)
    saved_session_id: int | None = None

    if loaded is not None:
        facts = running_session_facts(loaded[0])

        if facts.submission_id != submission_id or facts.paused_at is None:
            return _respond(user_id, loaded, now, conflict=True)

        try:
            if _claim_row(facts):
                session = _add_saved_session(
                    facts, now, actual_time_seconds(facts, now)
                )
                db.session.flush()
                saved_session_id = session.id
                db.session.commit()
            else:
                db.session.rollback()
        except IntegrityError:
            db.session.rollback()

    if saved_session_id is None:
        saved_session_id = _find_saved_session_id(user_id, submission_id)

    if saved_session_id is not None:
        # The user is present, so they must not be told the session ended on its own.
        db.session.execute(
            delete(SessionEndNotice).where(SessionEndNotice.user_id == user_id)
        )
        db.session.commit()

    envelope = _respond(user_id, None, now)
    return {**envelope, "saved": saved_session_id is not None, "session_id": saved_session_id}
