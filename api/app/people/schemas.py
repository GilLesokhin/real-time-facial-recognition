import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

# The photo is a separate File parameter in the router. These are the form's text fields.


class PersonCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=255)
    apartment: str = Field(min_length=1, max_length=255)


class PersonUpdateRequest(BaseModel):
    """Send only what changes. A field left out, or sent empty, keeps its value."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=255)
    apartment: str | None = Field(default=None, min_length=1, max_length=255)


class PersonBase(BaseModel):
    """The person fields the API sends. Never the embedding. Matches `Person` in web/src/types.ts."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    building_id: uuid.UUID
    name: str
    apartment: str
    created_at: datetime


class PersonListItem(PersonBase):
    """One person in the GET /buildings/{id}/people list."""


class PersonCreateResponse(PersonBase):
    pass


class PersonUpdateResponse(PersonBase):
    pass
