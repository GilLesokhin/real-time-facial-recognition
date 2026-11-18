import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PersonOut(BaseModel):
    """No photo here: the web app loads it from GET /people/{id}/photo."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    building_id: uuid.UUID
    name: str
    apartment: str
    created_at: datetime
