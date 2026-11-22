import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.users.models import UserRole


class UserBase(BaseModel):
    """The user fields every endpoint sends back. Matches `User` in web/src/types.ts."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: EmailStr
    role: UserRole
    building_id: uuid.UUID | None
    created_at: datetime


class UserListItem(UserBase):
    """One user in the GET /users list."""


class UserUpdateRequest(BaseModel):
    """Always both fields. `building_id` is set for a Building Admin and null for everyone else."""

    role: UserRole
    building_id: uuid.UUID | None


class UserUpdateResponse(UserBase):
    pass
