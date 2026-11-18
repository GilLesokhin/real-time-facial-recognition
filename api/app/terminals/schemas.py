import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.access.models import AccessResult


class TerminalOut(BaseModel):
    id: uuid.UUID
    building_id: uuid.UUID
    name: str
    # The newest check at this door. Null when there's none yet.
    last_result: AccessResult | None = None
    last_at: datetime | None = None


class TerminalIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class TerminalKeyOut(BaseModel):
    """Shown once. The terminal sends it as `Authorization: Bearer <key>`."""

    key: str


class TerminalScreenOut(BaseModel):
    """What the door screen shows."""

    id: uuid.UUID
    name: str
    building_id: uuid.UUID
    building_name: str
