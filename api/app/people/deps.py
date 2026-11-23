import uuid
from typing import Annotated

from fastapi import Depends, HTTPException

from app.auth.deps import SignedAdmin
from app.buildings.deps import can_manage
from app.core.db import SessionDep
from app.people import db as people_db
from app.people.models import Person


def manageable_person(person_id: uuid.UUID, admin: SignedAdmin, session: SessionDep) -> Person:
    """The `{person_id}` in the URL, if it's active and the admin can manage its building.

    404 for a person you can't manage, so the answer doesn't reveal that they exist.
    """
    person = people_db.get_active_person(session, person_id)
    if person is None or not person.building.is_active or not can_manage(admin, person.building_id):
        raise HTTPException(404, "Person not found.")
    return person


# Short form for routes with `{person_id}` in the path: `person: ManageablePerson`.
ManageablePerson = Annotated[Person, Depends(manageable_person)]
