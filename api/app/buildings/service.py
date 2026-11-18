import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.buildings import db
from app.buildings.models import Building
from app.users.models import User, UserRole

NOT_FOUND = "Building not found."
NAME_TAKEN = "A building with this name already exists."


def can_reach(admin: User, building_id: uuid.UUID) -> bool:
    return admin.role == UserRole.PLATFORM_ADMIN or admin.building_id == building_id


def reachable_building(session: Session, admin: User, building_id: uuid.UUID) -> Building:
    """The guard for every building URL. A building you can't reach looks the same as one that doesn't exist."""
    building = db.get_active_building(session, building_id)
    if building is None or not can_reach(admin, building_id):
        raise HTTPException(404, NOT_FOUND)
    return building


def list_buildings(session: Session, admin: User) -> list[Building]:
    if admin.role == UserRole.PLATFORM_ADMIN:
        return db.list_active_buildings(session)
    building = db.get_active_building(session, admin.building_id) if admin.building_id else None
    return [building] if building else []


def add_building(session: Session, name: str, address: str) -> Building:
    if db.name_taken(session, name):
        raise HTTPException(409, NAME_TAKEN)
    building = db.add_building(session, Building(name=name, address=address))
    session.commit()
    return building


def edit_building(
    session: Session, admin: User, building_id: uuid.UUID, name: str | None, address: str | None
) -> Building:
    building = reachable_building(session, admin, building_id)
    if name is not None and db.name_taken(session, name, except_id=building.id):
        raise HTTPException(409, NAME_TAKEN)
    if name is not None:
        building.name = name
    if address is not None:
        building.address = address
    session.commit()
    return building


def remove_building(session: Session, admin: User, building_id: uuid.UUID) -> None:
    """Deactivates the building with its people and terminals. The access log stays."""
    building = reachable_building(session, admin, building_id)
    db.deactivate_building(session, building)
    session.commit()
