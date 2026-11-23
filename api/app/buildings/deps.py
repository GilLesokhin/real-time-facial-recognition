import uuid
from typing import Annotated

from fastapi import Depends, HTTPException

from app.auth.deps import SignedAdmin
from app.buildings import db as buildings_db
from app.buildings.models import Building
from app.core.db import SessionDep
from app.users.models import User, UserRole


def can_manage(admin: User, building_id: uuid.UUID) -> bool:
    """A Platform Admin manages every building. A Building Admin manages only their own."""
    return admin.role == UserRole.PLATFORM_ADMIN or admin.building_id == building_id


def manageable_building(building_id: uuid.UUID, admin: SignedAdmin, session: SessionDep) -> Building:
    """The `{building_id}` in the URL, if the admin can manage it.

    404, not 403, for a building you can't manage, so the answer doesn't reveal that it exists.
    """
    building = buildings_db.get_active_building(session, building_id)
    if building is None or not can_manage(admin, building.id):
        raise HTTPException(404, "Building not found.")
    return building


# Short form for routes with `{building_id}` in the path: `building: ManageableBuilding`.
ManageableBuilding = Annotated[Building, Depends(manageable_building)]
