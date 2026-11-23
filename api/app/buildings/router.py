from fastapi import APIRouter, status

from app.auth.deps import PlatformAdmin, SignedAdmin
from app.buildings import service
from app.buildings.deps import ManageableBuilding
from app.buildings.schemas import (
    BuildingCreateRequest,
    BuildingCreateResponse,
    BuildingListItem,
    BuildingUpdateRequest,
    BuildingUpdateResponse,
)
from app.core.db import SessionDep

router = APIRouter(prefix="/buildings", tags=["buildings"])


@router.get("", response_model=list[BuildingListItem])
def list_buildings(admin: SignedAdmin, session: SessionDep):
    """All active buildings for a Platform Admin. A Building Admin's own building."""
    return service.list_buildings(session, admin)


@router.post("", response_model=BuildingCreateResponse, status_code=status.HTTP_201_CREATED)
def add_building(body: BuildingCreateRequest, admin: PlatformAdmin, session: SessionDep):
    return service.add_building(session, body.name, body.address)


@router.patch("/{building_id}", response_model=BuildingUpdateResponse)
def update_building(body: BuildingUpdateRequest, admin: PlatformAdmin, building: ManageableBuilding, session: SessionDep):
    return service.update_building(session, building, body.name, body.address)


@router.delete("/{building_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_building(admin: PlatformAdmin, building: ManageableBuilding, session: SessionDep) -> None:
    """Deactivates the building with its terminals and people."""
    service.deactivate_building(session, building)
