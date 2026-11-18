import uuid
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app.access import service
from app.access.models import AccessResult
from app.access.schemas import AccessEventOut, IdentifyOut
from app.auth.deps import CurrentAdmin
from app.core.db import SessionDep
from app.terminals.deps import CurrentTerminal

router = APIRouter(tags=["access"])

MAX_IMAGE_BYTES = 2 * 1024 * 1024


@router.post("/terminals/{terminal_id}/identify", response_model=IdentifyOut)
async def identify(terminal: CurrentTerminal, session: SessionDep, image: Annotated[UploadFile, File()]):
    """Terminal sign-in only. A mirrored face crop (JPEG, about 256 px) in, granted or denied out."""
    data = await image.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "The image is too big.")
    return service.identify(session, terminal, data)


@router.get("/buildings/{building_id}/access-log", response_model=list[AccessEventOut])
def access_log(
    building_id: uuid.UUID,
    admin: CurrentAdmin,
    session: SessionDep,
    terminal: uuid.UUID | None = None,
    result: AccessResult | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
):
    """Newest first."""
    return service.access_log(session, admin, building_id, terminal, result, limit)
