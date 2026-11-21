import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Request

from app.core.db import SessionDep
from app.users import db as users_db
from app.users.models import User, UserRole


def current_admin(request: Request, session: SessionDep) -> User:
    """Loads the user on every request, so a deleted or demoted user is locked out at once."""
    raw_id = request.session.get("user_id")
    user = None
    if raw_id:
        try:
            user = users_db.get_user(session, uuid.UUID(raw_id))
        except ValueError:
            user = None
    if user is None or user.role == UserRole.UNASSIGNED:
        request.session.clear()
        raise HTTPException(401, "Not signed in.")
    return user


# Short form for routes: `admin: CurrentAdmin`.
CurrentAdmin = Annotated[User, Depends(current_admin)]


def current_platform_admin(admin: CurrentAdmin) -> User:
    if admin.role != UserRole.PLATFORM_ADMIN:
        raise HTTPException(403, "Platform Admin access required.")
    return admin


# Short form for Platform Admin routes: `admin: PlatformAdmin`.
PlatformAdmin = Annotated[User, Depends(current_platform_admin)]
