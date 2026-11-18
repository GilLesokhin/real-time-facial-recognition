import uuid
from datetime import datetime

from pydantic import BaseModel

from app.access.models import AccessResult


class MatchOut(BaseModel):
    id: uuid.UUID
    name: str


class IdentifyOut(BaseModel):
    result: AccessResult
    # The person let in. Null when denied.
    person: MatchOut | None
    # Similarity of the nearest person. Null when nobody is enrolled.
    score: float | None


class AccessEventOut(BaseModel):
    id: uuid.UUID
    terminal_id: uuid.UUID
    terminal_name: str
    person_id: uuid.UUID | None
    person_name: str | None
    result: AccessResult
    score: float | None
    created_at: datetime
