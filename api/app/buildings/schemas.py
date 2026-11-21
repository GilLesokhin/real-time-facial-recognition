import uuid

from pydantic import BaseModel, ConfigDict, Field


class BuildingCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=255)
    address: str = Field(default="", max_length=255)


class BuildingUpdateRequest(BaseModel):
    """Only the fields you send change."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=255)
    address: str | None = Field(default=None, max_length=255)


class BuildingBase(BaseModel):
    """The building fields the API sends. Each endpoint has its own subclass. Matches `Building` in web/src/types.ts."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    address: str


class BuildingListItem(BuildingBase):
    """One building in the GET /buildings list."""


class BuildingCreateResponse(BuildingBase):
    pass


class BuildingUpdateResponse(BuildingBase):
    pass
