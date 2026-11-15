import re
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash  # type: ignore[reportUnknownVariableType]

from executionos.account.errors import (
    AccountNotFoundError,
    UsernameLockedError,
    UsernameTakenError,
    WrongPasswordError,
)
from executionos.extensions import db
from executionos.models import Follow, User
from executionos.params import parse_username
from executionos.social.service import ACCEPTED, PENDING
from executionos.timeutils import as_utc_aware, utc_iso


USERNAME_CHANGE_INTERVAL = timedelta(days=30)

_NEW_PASSWORD_PATTERN = re.compile(
    r"(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?~`]).{12,}"
)


def _get_user(user_id: int) -> User:
    user = db.session.get(User, user_id)

    if user is None:
        raise AccountNotFoundError()

    return user


def _next_username_change_at(user: User) -> datetime | None:
    """When the username can be changed again, or None when it can be changed now."""
    if user.username_changed_at is None:
        return None

    next_change_at = as_utc_aware(user.username_changed_at) + USERNAME_CHANGE_INTERVAL
    return next_change_at if next_change_at > datetime.now(UTC) else None


def get_account_for_user(user_id: int) -> dict[str, Any]:
    user = _get_user(user_id)
    next_change_at = _next_username_change_at(user)

    return {
        "username": user.username,
        "is_private": user.is_private,
        "username_next_change_at": None if next_change_at is None else utc_iso(next_change_at),
    }


def change_username_for_user(user_id: int, raw_username: object) -> dict[str, Any]:
    """Change the username, at most once every 30 days. Sending the current one changes nothing."""
    user = _get_user(user_id)
    username = parse_username(raw_username)

    if username != user.username:
        next_change_at = _next_username_change_at(user)
        if next_change_at is not None:
            raise UsernameLockedError(next_change_at)

        if db.session.execute(select(User.id).where(User.username == username)).first() is not None:
            raise UsernameTakenError()

        user.username = username
        user.username_changed_at = datetime.now(UTC)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            raise UsernameTakenError()

    return get_account_for_user(user_id)


def set_privacy_for_user(user_id: int, raw_is_private: object) -> bool:
    """Make the account private or public. Becoming public accepts the requests that are waiting."""
    if not isinstance(raw_is_private, bool):
        raise ValueError("isPrivate must be a boolean")

    user = _get_user(user_id)
    user.is_private = raw_is_private

    if not raw_is_private:
        db.session.execute(
            update(Follow)
            .where(Follow.followee_id == user_id, Follow.status == PENDING)
            .values(status=ACCEPTED)
        )

    db.session.commit()
    return raw_is_private


def change_password_for_user(user_id: int, raw_current_password: object, raw_new_password: object) -> User:
    """Change the password and end every other session, because refresh tokens carry the old token version."""
    user = _get_user(user_id)

    if (
        not isinstance(raw_current_password, str)
        or not isinstance(raw_new_password, str)
        or _NEW_PASSWORD_PATTERN.fullmatch(raw_new_password) is None
    ):
        raise ValueError("A current password and a strong new password are required")

    if not cast(bool, check_password_hash(user.password_hash, raw_current_password)):
        raise WrongPasswordError()

    user.password_hash = cast(str, generate_password_hash(raw_new_password))
    user.token_version += 1
    db.session.commit()

    return user
