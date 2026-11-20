import uuid

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint, func, true
from sqlalchemy.orm import Mapped, mapped_column

from app.buildings.models import Building
from app.core.db import Base


class Terminal(Base):
    """A door with a camera and screen. Soft delete."""

    __tablename__ = "terminals"
    # Lets access_events check that its terminal is in the same building.
    __table_args__ = (UniqueConstraint("id", "building_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    building_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(Building.id, ondelete="RESTRICT"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(default=True, server_default=true())


# One active terminal per name in a building, ignoring case.
Index(
    "uq_terminals_active_name",
    Terminal.building_id,
    func.lower(Terminal.name),
    unique=True,
    postgresql_where=Terminal.is_active,
)
