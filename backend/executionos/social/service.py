"""Follows, follow requests, and blocks. Every action takes the username of the other person."""
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import and_, delete, or_, select
from sqlalchemy.dialects.sqlite import insert

from executionos.extensions import db
from executionos.models import Block, Follow, User
from executionos.social.errors import UserNotAvailableError


ACCEPTED = "accepted"
PENDING = "pending"


def _find_other_user(user_id: int, raw_username: str) -> User:
    """The user with this username, unless it does not exist or is the requester."""
    other = db.session.execute(
        select(User).where(User.username == raw_username.strip().lower())
    ).scalar_one_or_none()

    if other is None or other.id == user_id:
        raise UserNotAvailableError()

    return other


def _is_blocked_between(user_id: int, other_id: int) -> bool:
    return db.session.execute(
        select(Block.id).where(or_(
            and_(Block.blocker_id == user_id, Block.blocked_id == other_id),
            and_(Block.blocker_id == other_id, Block.blocked_id == user_id),
        ))
    ).first() is not None


def find_available_user(user_id: int, raw_username: str) -> User:
    """Like `_find_other_user`, and also unavailable when either of the two blocked the other."""
    other = _find_other_user(user_id, raw_username)

    if _is_blocked_between(user_id, other.id):
        raise UserNotAvailableError()

    return other


def _find_pending_request(user_id: int, requester_id: int) -> Follow:
    request = db.session.execute(
        select(Follow).where(
            Follow.follower_id == requester_id,
            Follow.followee_id == user_id,
            Follow.status == PENDING,
        )
    ).scalar_one_or_none()

    if request is None:
        raise UserNotAvailableError()

    return request


def follow_user_for_user(user_id: int, raw_username: str) -> str:
    """Follow someone. A private account turns it into a request. Following again changes nothing."""
    other = find_available_user(user_id, raw_username)
    statement = insert(Follow).values(
        follower_id=user_id,
        followee_id=other.id,
        status=PENDING if other.is_private else ACCEPTED,
        created_at=datetime.now(UTC),
    )
    db.session.execute(statement.on_conflict_do_nothing(index_elements=[Follow.follower_id, Follow.followee_id]))
    db.session.commit()

    return db.session.execute(
        select(Follow.status).where(Follow.follower_id == user_id, Follow.followee_id == other.id)
    ).scalar_one()


def unfollow_user_for_user(user_id: int, raw_username: str) -> None:
    """Stop following someone, or take back a request."""
    other = find_available_user(user_id, raw_username)
    db.session.execute(delete(Follow).where(Follow.follower_id == user_id, Follow.followee_id == other.id))
    db.session.commit()


def accept_follow_request_for_user(user_id: int, raw_username: str) -> None:
    other = find_available_user(user_id, raw_username)
    _find_pending_request(user_id, other.id).status = ACCEPTED
    db.session.commit()


def decline_follow_request_for_user(user_id: int, raw_username: str) -> None:
    other = find_available_user(user_id, raw_username)
    db.session.delete(_find_pending_request(user_id, other.id))
    db.session.commit()


def block_user_for_user(user_id: int, raw_username: str) -> None:
    """Block someone. Any follow between the two ends, in both directions."""
    other = _find_other_user(user_id, raw_username)
    db.session.execute(delete(Follow).where(or_(
        and_(Follow.follower_id == user_id, Follow.followee_id == other.id),
        and_(Follow.follower_id == other.id, Follow.followee_id == user_id),
    )))
    statement = insert(Block).values(blocker_id=user_id, blocked_id=other.id, created_at=datetime.now(UTC))
    db.session.execute(statement.on_conflict_do_nothing(index_elements=[Block.blocker_id, Block.blocked_id]))
    db.session.commit()


def unblock_user_for_user(user_id: int, raw_username: str) -> None:
    other = _find_other_user(user_id, raw_username)
    db.session.execute(delete(Block).where(Block.blocker_id == user_id, Block.blocked_id == other.id))
    db.session.commit()


def list_blocked_for_user(user_id: int) -> list[dict[str, Any]]:
    """The people the user blocked, the latest first."""
    usernames = db.session.execute(
        select(User.username)
        .join(Block, Block.blocked_id == User.id)
        .where(Block.blocker_id == user_id)
        .order_by(Block.created_at.desc(), Block.id.desc())
    ).scalars()

    return [{"username": username} for username in usernames]
