import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    DateTime,
    ForeignKey,
    LargeBinary,
    String,
    UniqueConstraint,
    func,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.buildings.models import Building
from app.core.db import Base

EMBEDDING_SIZE = 128


class Person(Base):
    """A resident allowed through the door, with one face. Soft delete."""

    __tablename__ = "people"
    # Lets access_events check that its person is in the same building.
    __table_args__ = (UniqueConstraint("id", "building_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    building_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(Building.id, ondelete="RESTRICT"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    apartment: Mapped[str] = mapped_column(String(255))
    # Deferred: loads only when the code reads person.photo, never with the person.
    photo: Mapped[bytes] = mapped_column(LargeBinary, deferred=True)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_SIZE))
    is_active: Mapped[bool] = mapped_column(default=True, server_default=true())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
