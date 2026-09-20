from datetime import datetime

from sqlalchemy import String, ForeignKey
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

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    date: Mapped[datetime] = mapped_column(nullable=False)
    mission: Mapped[str] = mapped_column(String(200), nullable=False)
    target_time_seconds: Mapped[int] = mapped_column(nullable=False)
    actual_time_seconds: Mapped[int] = mapped_column(nullable=False)

    def __init__(self, user_id: int, date: datetime, mission: str, target_time_seconds: int, actual_time_seconds: int) -> None:
        self.user_id = user_id
        self.date = date
        self.mission = mission
        self.target_time_seconds = target_time_seconds
        self.actual_time_seconds = actual_time_seconds

    def __repr__(self) -> str:
        return f"<Session {self.id} user={self.user_id} mission={self.mission!r}>"

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
