from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.buildings.models import Building
from app.faces.embedding import FaceError, embed_face
from app.people import db as people_db
from app.people.models import Person

# The browser sends a 320x320 JPEG of about 22 KB. 1 MB leaves room for any real photo.
MAX_PHOTO_BYTES = 1024 * 1024


def read_photo(photo: UploadFile) -> bytes:
    # Read one byte past the limit: that's enough to know the file is too big.
    data = photo.file.read(MAX_PHOTO_BYTES + 1)
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(413, "The photo is over 1 MB.")
    return data


def embed(photo: UploadFile) -> list[float]:
    """The face's embedding. The photo itself is never saved."""
    try:
        return embed_face(read_photo(photo))
    except FaceError as error:
        raise HTTPException(422, str(error)) from error


def list_people(session: Session, building: Building, search: str | None) -> list[Person]:
    return people_db.list_active_people(session, building.id, search)


def add_person(session: Session, building: Building, name: str, apartment: str, photo: UploadFile) -> Person:
    embedding = embed(photo)
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
        person.embedding = embed(photo)
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
