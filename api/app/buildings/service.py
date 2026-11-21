from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.buildings import db as buildings_db
from app.buildings.models import Building
from app.users.models import User, UserRole


def list_buildings(session: Session, admin: User) -> list[Building]:
    if admin.role == UserRole.PLATFORM_ADMIN:
        return buildings_db.list_active_buildings(session)
    building = buildings_db.get_active_building(session, admin.building_id) if admin.building_id else None
    if building is None:
        return []
    return [building]


def add_building(session: Session, name: str, address: str) -> Building:
    if buildings_db.get_active_building_by_name(session, name):
        raise HTTPException(409, "A building with this name already exists.")
    building = buildings_db.add_building(session, Building(name=name, address=address))
    session.commit()
    return building


def update_building(session: Session, building: Building, name: str | None, address: str | None) -> Building:
    if name is not None:
        same_name = buildings_db.get_active_building_by_name(session, name)
        if same_name and same_name.id != building.id:
            raise HTTPException(409, "A building with this name already exists.")
        building.name = name
    if address is not None:
        building.address = address
    session.commit()
    return building


def deactivate_building(session: Session, building: Building) -> None:
    """Soft delete: the building, its terminals and its people stop working. Their rows stay."""
    building.is_active = False
    buildings_db.deactivate_terminals_and_people(session, building.id)
    session.commit()
