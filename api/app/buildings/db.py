import uuid

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.buildings.models import Building
from app.people.models import Person
from app.terminals.models import Terminal


def list_active_buildings(session: Session) -> list[Building]:
    query = select(Building).where(Building.is_active).order_by(func.lower(Building.name))
    return list(session.scalars(query))


def get_active_building(session: Session, building_id: uuid.UUID) -> Building | None:
    building = session.get(Building, building_id)
    if building is None or not building.is_active:
        return None
    return building


def get_active_building_by_name(session: Session, name: str) -> Building | None:
    query = select(Building).where(Building.is_active, func.lower(Building.name) == name.lower())
    return session.scalars(query).first()


def add_building(session: Session, building: Building) -> Building:
    session.add(building)
    session.flush()
    return building


def deactivate_terminals_and_people(session: Session, building_id: uuid.UUID) -> None:
    session.execute(update(Terminal).where(Terminal.building_id == building_id).values(is_active=False))
    session.execute(update(Person).where(Person.building_id == building_id).values(is_active=False))
