import uuid

from pydantic import BaseModel, ConfigDict, Field


class BuildingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    address: str


class BuildingIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    address: str = Field(default="", max_length=255)


class BuildingPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    address: str | None = Field(default=None, max_length=255)
