from datetime import datetime

from sqlalchemy import Index, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from extensions import db


class User(db.Model):
    """User model for the application."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    token_version: Mapped[int] = mapped_column(default=0, nullable=False)

    def __init__(self, username: str, email: str, password_hash: str) -> None:
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self.token_version = 0

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
