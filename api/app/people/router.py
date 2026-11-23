from typing import Annotated

from fastapi import APIRouter, File, Form, Query, UploadFile, status

from app.auth.deps import SignedAdmin
from app.buildings.deps import ManageableBuilding
from app.core.db import SessionDep
from app.people import service
from app.people.deps import ManageablePerson
from app.people.schemas import (
    PersonCreateRequest,
    PersonCreateResponse,
    PersonListItem,
    PersonUpdateRequest,
    PersonUpdateResponse,
)

router = APIRouter(tags=["people"])


@router.get("/buildings/{building_id}/people", response_model=list[PersonListItem])
def list_people(
    admin: SignedAdmin,
    building: ManageableBuilding,
    session: SessionDep,
    search: Annotated[str | None, Query(max_length=255)] = None,
):
    """The building's people by name. `search` looks in name and apartment, ignoring case."""
    return service.list_people(session, building, search.strip() if search else None)


@router.post("/buildings/{building_id}/people", response_model=PersonCreateResponse, status_code=status.HTTP_201_CREATED)
def add_person(
    body: Annotated[PersonCreateRequest, Form()],
    photo: Annotated[UploadFile, File()],
    admin: SignedAdmin,
    building: ManageableBuilding,
    session: SessionDep,
):
    """`multipart/form-data`. The photo is the browser's face crop. 422 when it has no face or more than one."""
    return service.add_person(session, building, body.name, body.apartment, photo)


@router.patch("/people/{person_id}", response_model=PersonUpdateResponse)
def update_person(
    body: Annotated[PersonUpdateRequest, Form()],
    admin: SignedAdmin,
    person: ManageablePerson,
    session: SessionDep,
    photo: Annotated[UploadFile | None, File()] = None,
):
    """`multipart/form-data`. Send only what changes. A new photo replaces the face."""
    return service.update_person(session, person, body.name, body.apartment, photo)


@router.delete("/people/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_person(admin: SignedAdmin, person: ManageablePerson, session: SessionDep) -> None:
    """Soft delete. Their past checks stay in the access log."""
    service.remove_person(session, person)
