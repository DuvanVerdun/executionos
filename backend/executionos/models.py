from datetime import datetime

from sqlalchemy import Index, String, ForeignKey, UniqueConstraint, false
from sqlalchemy.orm import Mapped, mapped_column

from executionos.extensions import db


class User(db.Model):
    """User model for the application."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    token_version: Mapped[int] = mapped_column(default=0, nullable=False)
    is_private: Mapped[bool] = mapped_column(default=False, server_default=false(), nullable=False)
    username_changed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    def __init__(self, username: str, email: str, password_hash: str) -> None:
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self.token_version = 0
        self.is_private = False
        self.username_changed_at = None

    def __repr__(self) -> str:
        return f"<User {self.username}>"


class Session(db.Model):
    """Session model for the application."""
    __tablename__ = "sessions"
    __table_args__ = (
        UniqueConstraint("user_id", "submission_id", name="uq_sessions_user_submission"),
        Index("ix_sessions_room_id_date", "room_id", "date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    date: Mapped[datetime] = mapped_column(nullable=False)
    mission: Mapped[str] = mapped_column(String(200), nullable=False)
    target_time_seconds: Mapped[int] = mapped_column(nullable=False)
    actual_time_seconds: Mapped[int] = mapped_column(nullable=False)
    submission_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    room_id: Mapped[int | None] = mapped_column(ForeignKey("rooms.id"), nullable=True)

    def __init__(self, user_id: int, date: datetime, mission: str, target_time_seconds: int, actual_time_seconds: int) -> None:
        self.user_id = user_id
        self.date = date
        self.mission = mission
        self.target_time_seconds = target_time_seconds
        self.actual_time_seconds = actual_time_seconds

    def __repr__(self) -> str:
        return f"<Session {self.id} user={self.user_id} mission={self.mission!r}>"

class Room(db.Model):
    """Room model for the application."""
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    link_token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(nullable=False)

    def __init__(self, name: str, link_token: str, created_at: datetime) -> None:
        self.name = name
        self.link_token = link_token
        self.created_at = created_at

    def __repr__(self) -> str:
        return f"<Room {self.id} name={self.name!r}>"


class RoomMembership(db.Model):
    """Membership of a user in a room. One row per user per room, forever."""
    __tablename__ = "room_memberships"
    __table_args__ = (UniqueConstraint("room_id", "user_id", name="uq_room_memberships_room_user"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    joined_at: Mapped[datetime] = mapped_column(nullable=False)
    left_at: Mapped[datetime | None] = mapped_column(nullable=True)
    show_missions: Mapped[bool] = mapped_column(default=True, nullable=False)

    def __init__(self, room_id: int, user_id: int, joined_at: datetime) -> None:
        self.room_id = room_id
        self.user_id = user_id
        self.joined_at = joined_at
        self.left_at = None
        self.show_missions = True

    def __repr__(self) -> str:
        return f"<RoomMembership {self.id} room={self.room_id} user={self.user_id}>"


class ActiveRoomSession(db.Model):
    """A room session in progress. At most one per user."""
    __tablename__ = "active_room_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, unique=True
    )
    room_id: Mapped[int] = mapped_column(
        ForeignKey("rooms.id"), nullable=False, index=True
    )
    submission_id: Mapped[str] = mapped_column(String(36), nullable=False)
    mission: Mapped[str] = mapped_column(String(200), nullable=False)
    target_time_seconds: Mapped[int] = mapped_column(nullable=False)
    started_at: Mapped[datetime] = mapped_column(nullable=False)
    paused_at: Mapped[datetime | None] = mapped_column(nullable=True)
    paused_seconds: Mapped[float] = mapped_column(default=0.0, nullable=False)
    last_checkin_mark: Mapped[int] = mapped_column(default=0, nullable=False)
    last_interaction_at: Mapped[datetime | None] = mapped_column(nullable=True)
    last_interaction_actual_seconds: Mapped[int | None] = mapped_column(nullable=True)
    last_heartbeat_at: Mapped[datetime] = mapped_column(nullable=False)

    def __init__(
        self,
        user_id: int,
        room_id: int,
        submission_id: str,
        mission: str,
        target_time_seconds: int,
        started_at: datetime,
    ) -> None:
        self.user_id = user_id
        self.room_id = room_id
        self.submission_id = submission_id
        self.mission = mission
        self.target_time_seconds = target_time_seconds
        self.started_at = started_at
        self.paused_at = None
        self.paused_seconds = 0.0
        self.last_checkin_mark = 0
        self.last_interaction_at = None
        self.last_interaction_actual_seconds = None
        self.last_heartbeat_at = started_at

    def __repr__(self) -> str:
        return f"<ActiveRoomSession {self.id} user={self.user_id} room={self.room_id}>"


class SessionEndNotice(db.Model):
    """A one-time note telling a user how a session ended without them."""
    __tablename__ = "session_end_notices"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, unique=True
    )
    reason: Mapped[str] = mapped_column(String(32), nullable=False)
    saved: Mapped[bool] = mapped_column(nullable=False)
    actual_time_seconds: Mapped[int | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(nullable=False)

    def __init__(
        self,
        user_id: int,
        reason: str,
        saved: bool,
        actual_time_seconds: int | None,
        created_at: datetime,
    ) -> None:
        self.user_id = user_id
        self.reason = reason
        self.saved = saved
        self.actual_time_seconds = actual_time_seconds
        self.created_at = created_at

    def __repr__(self) -> str:
        return f"<SessionEndNotice {self.id} user={self.user_id} reason={self.reason}>"


class Follow(db.Model):
    """A follow of one user by another. It is pending until a private account accepts it."""
    __tablename__ = "follows"
    __table_args__ = (UniqueConstraint("follower_id", "followee_id", name="uq_follows_follower_followee"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    follower_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    followee_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(nullable=False)

    def __init__(self, follower_id: int, followee_id: int, status: str, created_at: datetime) -> None:
        self.follower_id = follower_id
        self.followee_id = followee_id
        self.status = status
        self.created_at = created_at

    def __repr__(self) -> str:
        return f"<Follow {self.id} {self.follower_id}->{self.followee_id} status={self.status}>"


class Block(db.Model):
    """A user blocking another. The blocked user cannot find or follow the blocker."""
    __tablename__ = "blocks"
    __table_args__ = (UniqueConstraint("blocker_id", "blocked_id", name="uq_blocks_blocker_blocked"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    blocker_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    blocked_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(nullable=False)

    def __init__(self, blocker_id: int, blocked_id: int, created_at: datetime) -> None:
        self.blocker_id = blocker_id
        self.blocked_id = blocked_id
        self.created_at = created_at

    def __repr__(self) -> str:
        return f"<Block {self.id} {self.blocker_id}->{self.blocked_id}>"


class Presence(db.Model):
    """The last live state a client reported for a user. One per user, replaced on every report."""
    __tablename__ = "presences"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, unique=True
    )
    state: Mapped[str] = mapped_column(String(16), nullable=False)
    mission: Mapped[str | None] = mapped_column(String(200), nullable=True)
    worked_seconds: Mapped[int] = mapped_column(nullable=False)
    target_seconds: Mapped[int] = mapped_column(nullable=False)
    reported_at: Mapped[datetime] = mapped_column(nullable=False)

    def __init__(
        self,
        user_id: int,
        state: str,
        mission: str | None,
        worked_seconds: int,
        target_seconds: int,
        reported_at: datetime,
    ) -> None:
        self.user_id = user_id
        self.state = state
        self.mission = mission
        self.worked_seconds = worked_seconds
        self.target_seconds = target_seconds
        self.reported_at = reported_at

    def __repr__(self) -> str:
        return f"<Presence {self.id} user={self.user_id} state={self.state}>"


class Feedback(db.Model):
    """Feedback model for the application."""
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    message: Mapped[str] = mapped_column(String(2000), nullable=False)
    created_at: Mapped[datetime] = mapped_column(nullable=False)
    
    def __init__(self, user_id: int, message: str, created_at: datetime) -> None:
        self.user_id = user_id
        self.message = message
        self.created_at = created_at

    def __repr__(self) -> str:
        return f"<Feedback {self.id} user={self.user_id} message={self.message!r}>"
