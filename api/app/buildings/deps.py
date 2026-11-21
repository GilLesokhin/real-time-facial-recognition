import uuid
from typing import Annotated

from fastapi import Depends, HTTPException

from app.auth.deps import CurrentAdmin
from app.buildings import db as buildings_db
from app.buildings.models import Building
from app.core.db import SessionDep
from app.users.models import UserRole


def reachable_building(building_id: uuid.UUID, admin: CurrentAdmin, session: SessionDep) -> Building:
    """The `{building_id}` in the URL, if the admin can reach it.

    404, not 403, for a building you can't reach, so the answer doesn't reveal that it exists.
    """
    building = buildings_db.get_active_building(session, building_id)
    if building is None:
        raise HTTPException(404, "Building not found.")
    if admin.role != UserRole.PLATFORM_ADMIN and admin.building_id != building.id:
        raise HTTPException(404, "Building not found.")
    return building


# Short form for routes with `{building_id}` in the path: `building: ReachableBuilding`.
ReachableBuilding = Annotated[Building, Depends(reachable_building)]
