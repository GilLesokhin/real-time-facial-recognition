import uuid

from sqlalchemy import Index, String, func, true
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Building(Base):
    """Soft delete: deactivating sets is_active to false. Rows are never deleted."""

    __tablename__ = "buildings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(default=True, server_default=true())


# One active building per name, ignoring case. A deactivated building frees its name.
Index("uq_buildings_active_name", func.lower(Building.name), unique=True, postgresql_where=Building.is_active)
