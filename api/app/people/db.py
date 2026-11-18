import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.people.models import Person


def get_active_person(session: Session, person_id: uuid.UUID) -> Person | None:
    person = session.get(Person, person_id)
    return person if person and person.is_active else None


def get_photo(session: Session, person_id: uuid.UUID) -> bytes | None:
    """The only query that loads `photo`."""
    return session.scalars(select(Person.photo).where(Person.id == person_id, Person.is_active)).first()


def list_people(session: Session, building_id: uuid.UUID, q: str | None) -> list[Person]:
    query = select(Person).where(Person.building_id == building_id, Person.is_active)
    if q:
        pattern = f"%{q.lower()}%"
        query = query.where(or_(func.lower(Person.name).like(pattern), func.lower(Person.apartment).like(pattern)))
    return list(session.scalars(query.order_by(Person.created_at.desc())))


def add_person(session: Session, person: Person) -> Person:
    session.add(person)
    session.flush()
    return person
