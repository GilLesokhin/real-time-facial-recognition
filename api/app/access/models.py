import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class AccessResult(StrEnum):
    GRANTED = "granted"
    DENIED = "denied"


class AccessEvent(Base):
    """One face check at a door. Written by identify, never edited."""

    __tablename__ = "access_events"
    __table_args__ = (
        # The terminal and the person must be in the event's building.
        ForeignKeyConstraint(
            ["terminal_id", "building_id"], ["terminals.id", "terminals.building_id"], ondelete="RESTRICT"
        ),
        ForeignKeyConstraint(["person_id", "building_id"], ["people.id", "people.building_id"], ondelete="RESTRICT"),
        CheckConstraint(
            "(result = 'granted' AND person_id IS NOT NULL) OR (result = 'denied' AND person_id IS NULL)",
            name="include_person_id_only_when_granted",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    building_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("buildings.id", ondelete="RESTRICT"))
    terminal_id: Mapped[uuid.UUID]
    person_id: Mapped[uuid.UUID | None]
    result: Mapped[AccessResult] = mapped_column(
        Enum(AccessResult, name="access_result", values_callable=lambda results: [r.value for r in results])
    )
    # Similarity to the nearest person, for debugging denials. Null when no one is enrolled.
    score: Mapped[float | None]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# The access log: one building's events, newest first.
Index("ix_access_events_building_newest", AccessEvent.building_id, AccessEvent.created_at.desc())
