import uuid
from datetime import datetime

from pydantic import BaseModel

from app.access.models import AccessResult


class IdentifyResponse(BaseModel):
    """The door's answer. person_name is set only when granted."""

    result: AccessResult
    person_name: str | None


class AccessLogItem(BaseModel):
    """One check in the GET /buildings/{id}/access-log list. Matches `AccessEvent` in web/src/types.ts."""

    id: uuid.UUID
    terminal_id: uuid.UUID
    terminal_name: str
    person_id: uuid.UUID | None
    person_name: str | None
    result: AccessResult
    # Similarity to the nearest person. Null when no face was found or no one is enrolled.
    score: float | None
    created_at: datetime
