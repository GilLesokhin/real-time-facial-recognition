import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.access.models import AccessResult


class TerminalCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=255)


class TerminalUpdateRequest(BaseModel):
    """Rename. The name is the only field you can change."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=255)


class TerminalBase(BaseModel):
    """The terminal fields the API sends. Each endpoint has its own subclass. Matches `Terminal` in web/src/types.ts."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    building_id: uuid.UUID
    name: str


class TerminalAccessEvent(BaseModel):
    """A terminal's newest check, for the Last check column."""

    model_config = ConfigDict(from_attributes=True)

    result: AccessResult
    created_at: datetime


class TerminalListItem(TerminalBase):
    """One terminal in the GET /buildings/{id}/terminals list."""

    latest_event: TerminalAccessEvent | None


class TerminalCreateResponse(TerminalBase):
    pass


class TerminalUpdateResponse(TerminalBase):
    pass


class TerminalKeyResponse(TerminalBase):
    """The terminal's key, with the names the door tab shows."""

    key: str
    building_name: str
