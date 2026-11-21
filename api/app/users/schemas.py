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
    building_ids: list[uuid.UUID] = []
    created_at: datetime
