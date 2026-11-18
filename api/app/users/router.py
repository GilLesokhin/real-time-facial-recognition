import uuid

from fastapi import APIRouter, status

from app.auth.deps import PlatformAdmin
from app.core.db import SessionDep
from app.users import service
from app.users.models import UserRole
from app.users.schemas import UserAccessIn, UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(
    admin: PlatformAdmin,
    session: SessionDep,
    role: UserRole | None = None,
    building: uuid.UUID | None = None,
    q: str | None = None,
):
    """`building` keeps that building's Building Admins and every Platform Admin."""
    return service.list_users(session, role, building, q)


@router.patch("/{user_id}", response_model=UserOut)
def set_access(user_id: uuid.UUID, body: UserAccessIn, admin: PlatformAdmin, session: SessionDep):
    return service.set_access(session, admin, user_id, body.role, body.building_id)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: uuid.UUID, admin: PlatformAdmin, session: SessionDep) -> None:
    service.delete_user(session, admin, user_id)
