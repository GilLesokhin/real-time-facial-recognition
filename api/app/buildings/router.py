import uuid

from fastapi import APIRouter, status

from app.auth.deps import CurrentAdmin, PlatformAdmin
from app.buildings import service
from app.buildings.schemas import BuildingIn, BuildingOut, BuildingPatch
from app.core.db import SessionDep

router = APIRouter(prefix="/buildings", tags=["buildings"])


@router.get("", response_model=list[BuildingOut])
def list_buildings(admin: CurrentAdmin, session: SessionDep):
    """Every active building for a Platform Admin. Only their own for a Building Admin."""
    return service.list_buildings(session, admin)


@router.post("", response_model=BuildingOut, status_code=status.HTTP_201_CREATED)
def add_building(body: BuildingIn, admin: PlatformAdmin, session: SessionDep):
    return service.add_building(session, body.name.strip(), body.address.strip())


@router.patch("/{building_id}", response_model=BuildingOut)
def edit_building(building_id: uuid.UUID, body: BuildingPatch, admin: PlatformAdmin, session: SessionDep):
    name = body.name.strip() if body.name is not None else None
    address = body.address.strip() if body.address is not None else None
    return service.edit_building(session, admin, building_id, name, address)


@router.delete("/{building_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_building(building_id: uuid.UUID, admin: PlatformAdmin, session: SessionDep) -> None:
    """Deactivates the building, its people and its terminals."""
    service.remove_building(session, admin, building_id)
