import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.people.models import Person


def list_active_people(session: Session, building_id: uuid.UUID, search: str | None) -> list[Person]:
    """By name, then apartment. `search` looks in name and apartment, ignoring case."""
    query = select(Person).where(Person.building_id == building_id, Person.is_active)
    if search:
        query = query.where(
            or_(Person.name.icontains(search, autoescape=True), Person.apartment.icontains(search, autoescape=True))
        )
    query = query.order_by(func.lower(Person.name), func.lower(Person.apartment))
    return list(session.scalars(query))


def get_active_person(session: Session, person_id: uuid.UUID) -> Person | None:
    person = session.get(Person, person_id)
    if person is None or not person.is_active:
        return None
    return person


def get_active_person_by_name(session: Session, building_id: uuid.UUID, name: str) -> Person | None:
    query = select(Person).where(
        Person.building_id == building_id,
        Person.is_active,
        func.lower(Person.name) == name.lower(),
    )
    return session.scalars(query).first()


def add_person(session: Session, person: Person) -> Person:
    session.add(person)
    session.flush()  # sends the INSERT so id and created_at are filled in
    return person
