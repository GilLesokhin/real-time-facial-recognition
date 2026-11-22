import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.auth.deps import PlatformAdmin
from app.core.db import SessionDep
from app.users import service
from app.users.models import UserRole
from app.users.schemas import UserListItem, UserUpdateRequest, UserUpdateResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserListItem])
def list_users(
    admin: PlatformAdmin,
    session: SessionDep,
    role: UserRole | None = None,
    building: uuid.UUID | None = None,
    q: Annotated[str | None, Query(max_length=255)] = None,
):
    """Every account. `building` keeps the users who can manage it: its Building Admins and all Platform Admins.
    `q` searches name and email, ignoring case."""
    return service.list_users(session, role, building, q.strip() if q else None)


@router.patch("/{user_id}", response_model=UserUpdateResponse)
def set_access(user_id: uuid.UUID, body: UserUpdateRequest, admin: PlatformAdmin, session: SessionDep):
    return service.set_access(session, admin, user_id, body.role, body.building_id)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: uuid.UUID, admin: PlatformAdmin, session: SessionDep) -> None:
    service.delete_user(session, admin, user_id)
