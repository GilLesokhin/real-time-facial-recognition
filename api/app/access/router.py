import uuid
from typing import Annotated

from fastapi import APIRouter, File, UploadFile

from app.access import service
from app.access.models import AccessResult
from app.access.schemas import AccessLogItem, IdentifyResponse
from app.auth.deps import SignedAdmin
from app.buildings.deps import ManageableBuilding
from app.core.db import SessionDep
from app.terminals.deps import SignedTerminal

router = APIRouter(tags=["access"])


@router.post("/terminals/{terminal_id}/identify", response_model=IdentifyResponse)
def identify(photo: Annotated[UploadFile, File()], terminal: SignedTerminal, session: SessionDep):
    """`multipart/form-data`. The photo is the door's face crop. Every check is logged.

    No face is denied. 422 when the file isn't an image or is under 112 px, and that isn't logged.
    """
    return service.identify(session, terminal, photo)


@router.get("/buildings/{building_id}/access-log", response_model=list[AccessLogItem])
def list_access_log(
    admin: SignedAdmin,
    building: ManageableBuilding,
    session: SessionDep,
    terminal: uuid.UUID | None = None,
    result: AccessResult | None = None,
):
    """The building's newest 100 checks, newest first. `terminal` and `result` are optional filters."""
    return service.list_access_log(session, building, terminal, result)
