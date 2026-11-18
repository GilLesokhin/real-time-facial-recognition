import uuid

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.buildings.models import Building
from app.people.models import Person
from app.terminals.models import Terminal


def get_active_building(session: Session, building_id: uuid.UUID) -> Building | None:
    building = session.get(Building, building_id)
    return building if building and building.is_active else None


def list_active_buildings(session: Session) -> list[Building]:
    return list(session.scalars(select(Building).where(Building.is_active).order_by(func.lower(Building.name))))


def name_taken(session: Session, name: str, except_id: uuid.UUID | None = None) -> bool:
    query = select(Building.id).where(Building.is_active, func.lower(Building.name) == name.lower())
    if except_id:
        query = query.where(Building.id != except_id)
    return session.scalars(query).first() is not None


def add_building(session: Session, building: Building) -> Building:
    session.add(building)
    session.flush()
    return building


def deactivate_building(session: Session, building: Building) -> None:
    building.is_active = False
    session.execute(update(Person).where(Person.building_id == building.id).values(is_active=False))
    session.execute(
        update(Terminal).where(Terminal.building_id == building.id).values(is_active=False, key_hash=None)
    )
    session.flush()
