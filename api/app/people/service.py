import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.buildings.service import reachable_building
from app.core import faces
from app.people import db
from app.people.models import Person
from app.users.models import User

NOT_FOUND = "Person not found."


def _photo_and_embedding(data: bytes) -> tuple[bytes, list[float]]:
    try:
        return faces.prepare_photo(data)
    except (faces.NoFaceError, faces.NotAnImageError) as e:
        raise HTTPException(422, str(e)) from e


def reachable_person(session: Session, admin: User, person_id: uuid.UUID) -> Person:
    person = db.get_active_person(session, person_id)
    if person is None:
        raise HTTPException(404, NOT_FOUND)
    try:
        reachable_building(session, admin, person.building_id)
    except HTTPException:
        raise HTTPException(404, NOT_FOUND) from None
    return person


def list_people(session: Session, admin: User, building_id: uuid.UUID, q: str | None) -> list[Person]:
    reachable_building(session, admin, building_id)
    return db.list_people(session, building_id, q.strip() if q else None)


def add_person(
    session: Session, admin: User, building_id: uuid.UUID, name: str, apartment: str, photo: bytes
) -> Person:
    reachable_building(session, admin, building_id)
    jpeg, embedding = _photo_and_embedding(photo)
    person = db.add_person(
        session, Person(building_id=building_id, name=name, apartment=apartment, photo=jpeg, embedding=embedding)
    )
    session.commit()
    return person


def get_photo(session: Session, admin: User, person_id: uuid.UUID) -> bytes:
    reachable_person(session, admin, person_id)
    photo = db.get_photo(session, person_id)
    if photo is None:
        raise HTTPException(404, NOT_FOUND)
    return photo


def edit_person(
    session: Session,
    admin: User,
    person_id: uuid.UUID,
    name: str | None,
    apartment: str | None,
    photo: bytes | None,
) -> Person:
    person = reachable_person(session, admin, person_id)
    if name is not None:
        person.name = name
    if apartment is not None:
        person.apartment = apartment
    if photo is not None:
        person.photo, person.embedding = _photo_and_embedding(photo)
    session.commit()
    return person


def remove_person(session: Session, admin: User, person_id: uuid.UUID) -> None:
    """Deactivates the person: the door denies them at once. Their past checks stay in the log."""
    person = reachable_person(session, admin, person_id)
    person.is_active = False
    session.commit()
