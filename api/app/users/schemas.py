import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.users.models import UserRole


class UserOut(BaseModel):
    """The `User` from web/src/types.ts. Never includes the password hash."""

    # Lets a route return the SQLAlchemy User object; Pydantic reads its attributes.
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: EmailStr
    role: UserRole
    # Buildings a Building Admin manages. Always empty until the buildings feature adds user_buildings.
    building_ids: list[uuid.UUID] = []
    created_at: datetime
