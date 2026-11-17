import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class UserRole(StrEnum):
    UNASSIGNED = "unassigned"
    BUILDING_ADMIN = "building_admin"
    PLATFORM_ADMIN = "platform_admin"


class User(Base):
    """An admin account. Separate from the people who walk through the door."""

    __tablename__ = "users"
    # A Building Admin manages exactly one building. Nobody else has one.
    __table_args__ = (
        CheckConstraint(
            "(role = 'building_admin' AND building_id IS NOT NULL) OR (role <> 'building_admin' AND building_id IS NULL)",
            name="building_admin_has_building",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    # Stored lowercase, so "Ana@x.com" and "ana@x.com" are the same account.
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(
        # Store the values ("building_admin"), not the names.
        Enum(UserRole, name="user_role", values_callable=lambda roles: [r.value for r in roles]),
        default=UserRole.UNASSIGNED,
        server_default=UserRole.UNASSIGNED.value,
    )
    building_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("buildings.id", ondelete="RESTRICT"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
