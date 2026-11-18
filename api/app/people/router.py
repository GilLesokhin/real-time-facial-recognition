import uuid
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile, status

from app.auth.deps import CurrentAdmin
from app.core.db import SessionDep
from app.people import service
from app.people.schemas import PersonOut

router = APIRouter(tags=["people"])

MAX_PHOTO_BYTES = 10 * 1024 * 1024

Name = Annotated[str, Form(min_length=1, max_length=255)]
Apartment = Annotated[str, Form(max_length=255)]


async def read_photo(photo: UploadFile) -> bytes:
    data = await photo.read(MAX_PHOTO_BYTES + 1)
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(413, "The photo is too big. The limit is 10 MB.")
    return data


@router.get("/buildings/{building_id}/people", response_model=list[PersonOut])
def list_people(building_id: uuid.UUID, admin: CurrentAdmin, session: SessionDep, q: str | None = None):
    """Newest first. `q` searches name and apartment."""
    return service.list_people(session, admin, building_id, q)


@router.post("/buildings/{building_id}/people", response_model=PersonOut, status_code=status.HTTP_201_CREATED)
async def add_person(
    building_id: uuid.UUID,
    admin: CurrentAdmin,
    session: SessionDep,
    name: Name,
    photo: Annotated[UploadFile, File()],
    apartment: Apartment = "",
):
    """The photo must show one clear face. It's resized to 512 px and turned into an embedding."""
    data = await read_photo(photo)
    return service.add_person(session, admin, building_id, name.strip(), apartment.strip(), data)


@router.get("/people/{person_id}/photo", response_class=Response)
def get_photo(person_id: uuid.UUID, admin: CurrentAdmin, session: SessionDep):
    photo = service.get_photo(session, admin, person_id)
    return Response(photo, media_type="image/jpeg", headers={"Cache-Control": "private, no-cache"})


@router.patch("/people/{person_id}", response_model=PersonOut)
async def edit_person(
    person_id: uuid.UUID,
    admin: CurrentAdmin,
    session: SessionDep,
    name: Annotated[str | None, Form(min_length=1, max_length=255)] = None,
    apartment: Annotated[str | None, Form(max_length=255)] = None,
    photo: Annotated[UploadFile | None, File()] = None,
):
    """Send only what changes. A new photo replaces the photo and the embedding."""
    data = await read_photo(photo) if photo else None
    return service.edit_person(
        session,
        admin,
        person_id,
        name.strip() if name is not None else None,
        apartment.strip() if apartment is not None else None,
        data,
    )


@router.delete("/people/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_person(person_id: uuid.UUID, admin: CurrentAdmin, session: SessionDep) -> None:
    service.remove_person(session, admin, person_id)
