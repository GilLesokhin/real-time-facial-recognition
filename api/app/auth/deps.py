import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Request

from app.core.db import SessionDep
from app.users import db as users_db
from app.users.models import User, UserRole

SESSION_USER_ID = "user_id"


def current_admin(request: Request, session: SessionDep) -> User:
    """Loads the user on every request, so a deleted or demoted user is locked out at once."""
    raw_id = request.session.get(SESSION_USER_ID)
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
