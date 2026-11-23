from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.buildings.models import Building
from app.faces.upload import embed_enrollment_photo
from app.people import db as people_db
from app.people.models import Person


def list_people(session: Session, building: Building, search: str | None) -> list[Person]:
    return people_db.list_active_people(session, building.id, search)


def add_person(session: Session, building: Building, name: str, apartment: str, photo: UploadFile) -> Person:
    embedding = embed_enrollment_photo(photo)
    person = people_db.add_person(
        session, Person(building_id=building.id, name=name, apartment=apartment, embedding=embedding)
    )
    session.commit()
    return person


def update_person(
    session: Session, person: Person, name: str | None, apartment: str | None, photo: UploadFile | None
) -> Person:
    """Changes only what was sent. A new photo replaces the embedding."""
    if photo is not None:
        person.embedding = embed_enrollment_photo(photo)
    if name is not None:
        person.name = name
    if apartment is not None:
        person.apartment = apartment
    session.commit()
    return person


def remove_person(session: Session, person: Person) -> None:
    """Soft delete: the door stops letting them in. Their past checks stay in the access log."""
    person.is_active = False
    session.commit()
