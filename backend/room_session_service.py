from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Select, delete, select
from sqlalchemy.exc import IntegrityError

from dashboard_service import _as_utc_aware  # pyright: ignore[reportPrivateUsage]
from extensions import db
from models import ActiveRoomSession, Room, RoomMembership, Session, SessionEndNotice
from room_service import get_active_membership, running_session_facts
from room_session_rules import (
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


class RoomSessionConflictError(Exception):
    """A room-session request that conflicts with the current state. Carries the envelope."""

    def __init__(self, envelope: dict[str, Any]) -> None:
        super().__init__("Room session conflict")
        self.envelope = envelope


def _iso(value: datetime) -> str:
    """Naive UTC ISO 8601 with milliseconds. The client appends the Z."""
    return _as_utc_aware(value).replace(tzinfo=None).isoformat(timespec="milliseconds")


def _load_row(user_id: int) -> ActiveRoomSession | None:
    return db.session.execute(
        select(ActiveRoomSession).where(ActiveRoomSession.user_id == user_id)
    ).scalar_one_or_none()


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


def _session_payload(facts: RunningSessionFacts, now: datetime) -> dict[str, Any]:
    room_name = db.session.execute(
        select(Room.name).where(Room.id == facts.room_id)
    ).scalar_one_or_none()

    running = facts.paused_at is None

    return {
        "submission_id": facts.submission_id,
        "room_id": facts.room_id,
        "room_name": room_name,
        "mission": facts.mission,
        "target_time_seconds": facts.target_time_seconds,
        "started_at": _iso(facts.started_at),
        "paused_at": _iso(facts.paused_at) if facts.paused_at is not None else None,
        "paused_seconds": facts.paused_seconds,
        "actual_time_seconds": actual_time_seconds(facts, now),
        "state": "running" if running else "paused",
        "checkin": {
            "mark": facts.last_checkin_mark + 1,
            "due_at": _iso(checkin_due_at(facts)) if running else None,
            "deadline_at": _iso(checkin_deadline_at(facts)) if running else None,
            "outstanding": checkin_is_outstanding(facts, now),
        },
    }


def _respond(
    user_id: int,
    row: ActiveRoomSession | None,
    now: datetime,
    conflict: bool = False,
) -> dict[str, Any]:
    """Refresh the heartbeat, build the envelope, consume the notice, and commit."""
    if row is not None:
        row.last_heartbeat_at = now

    facts = running_session_facts(row) if row is not None else None

    envelope: dict[str, Any] = {
        "success": True,
        "server_time": _iso(now),
        "active": facts is not None,
        "session": _session_payload(facts, now) if facts is not None else None,
        "notice": _consume_notice(user_id),
    }
    db.session.commit()

    if conflict:
        raise RoomSessionConflictError({**envelope, "success": False})

    return envelope


def _begin(user_id: int) -> datetime:
    """Finalize this user's overdue row, then return the request time."""
    finalize_overdue_for_users([user_id])
    return datetime.now(UTC)


# ---------- Operations ----------

def get_room_session_for_user(user_id: int) -> dict[str, Any]:
    now = _begin(user_id)
    return _respond(user_id, _load_row(user_id), now)


def heartbeat_room_session_for_user(user_id: int) -> dict[str, Any]:
    return get_room_session_for_user(user_id)


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


def start_room_session_for_user(
    user_id: int,
    raw_room_id: object,
    raw_mission: object,
    raw_target_time_seconds: object,
) -> dict[str, Any]:
    room_id, mission, target_time_seconds = _validate_start_input(
        raw_room_id, raw_mission, raw_target_time_seconds
    )

    now = _begin(user_id)
    get_active_membership(room_id, user_id)

    existing = _load_row(user_id)
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

    return _respond(user_id, row, now)


def pause_room_session_for_user(user_id: int) -> dict[str, Any]:
    now = _begin(user_id)
    row = _load_row(user_id)

    if row is None:
        return _respond(user_id, None, now)

    facts = running_session_facts(row)

    if facts.paused_at is not None:
        return _respond(user_id, row, now)

    if checkin_is_outstanding(facts, now):
        return _respond(user_id, row, now, conflict=True)

    row.last_interaction_at = now
    row.last_interaction_actual_seconds = actual_time_seconds(facts, now)
    row.paused_at = now
    return _respond(user_id, row, now)


def resume_room_session_for_user(user_id: int) -> dict[str, Any]:
    now = _begin(user_id)
    row = _load_row(user_id)

    if row is None:
        return _respond(user_id, None, now)

    facts = running_session_facts(row)

    if facts.paused_at is not None:
        row.paused_seconds = facts.paused_seconds + (now - facts.paused_at).total_seconds()
        row.paused_at = None

    return _respond(user_id, row, now)


def checkin_room_session_for_user(user_id: int) -> dict[str, Any]:
    now = _begin(user_id)
    row = _load_row(user_id)

    if row is None:
        return _respond(user_id, None, now)

    facts = running_session_facts(row)

    if checkin_is_outstanding(facts, now) and now <= checkin_deadline_at(facts):
        row.last_checkin_mark = facts.last_checkin_mark + 1
        row.last_interaction_at = now
        row.last_interaction_actual_seconds = actual_time_seconds(facts, now)

    return _respond(user_id, row, now)


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

    now = _begin(user_id)
    row = _load_row(user_id)
    saved_session_id: int | None = None

    if row is not None:
        facts = running_session_facts(row)

        if facts.submission_id != submission_id or facts.paused_at is None:
            return _respond(user_id, row, now, conflict=True)

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
