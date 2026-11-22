import uuid

from pydantic import BaseModel, ConfigDict, Field


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


# GIL-79 (Identify + access log): each terminal's latest event. To restore, uncomment and import
# `datetime` and `AccessResult` (from app.access.models).
# class LatestEvent(BaseModel):
#     model_config = ConfigDict(from_attributes=True)
#
#     result: AccessResult
#     created_at: datetime


class TerminalListItem(TerminalBase):
    """One terminal in the GET /buildings/{id}/terminals list."""

    # GIL-79: latest_event: LatestEvent | None


class TerminalCreateResponse(TerminalBase):
    pass


class TerminalUpdateResponse(TerminalBase):
    pass


class TerminalKeyResponse(TerminalBase):
    """The terminal's key, with the names the door tab shows."""

    key: str
    building_name: str
