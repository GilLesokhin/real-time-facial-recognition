import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.users.models import UserRole


class UserOut(BaseModel):
    """Matches `User` in web/src/types.ts."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: EmailStr
    role: UserRole
    # The one building a Building Admin manages. Null for everyone else.
    building_id: uuid.UUID | None
    created_at: datetime


class UserAccessIn(BaseModel):
    role: UserRole
    building_id: uuid.UUID | None = None
