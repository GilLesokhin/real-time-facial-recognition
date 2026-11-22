import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.buildings import db as buildings_db
from app.users import db as users_db
from app.users.models import User, UserRole

# Why a role other than Building Admin can't have a building.
NO_BUILDING = {
    UserRole.PLATFORM_ADMIN: "A Platform Admin reaches every building. Set building_id to null.",
    UserRole.UNASSIGNED: "An Unassigned user has no building. Set building_id to null.",
}


def list_users(session: Session, role: UserRole | None, building_id: uuid.UUID | None, q: str | None) -> list[User]:
    return users_db.list_users(session, role, building_id, q)


def get_other_user(session: Session, admin: User, user_id: uuid.UUID, self_error: str) -> User:
    """The user to change. You can't change yourself: that could lock you out."""
    user = users_db.get_user(session, user_id)
    if user is None:
        raise HTTPException(404, "User not found.")
    if user.id == admin.id:
        raise HTTPException(403, self_error)
    return user


def set_access(session: Session, admin: User, user_id: uuid.UUID, role: UserRole, building_id: uuid.UUID | None) -> User:
    user = get_other_user(session, admin, user_id, "You can't change your own role.")
    if role == UserRole.BUILDING_ADMIN:
        if building_id is None:
            raise HTTPException(422, "A Building Admin needs a building.")
        if buildings_db.get_active_building(session, building_id) is None:
            raise HTTPException(422, "Pick an active building.")
    elif building_id is not None:
        raise HTTPException(422, NO_BUILDING[role])
    user.role = role
    user.building_id = building_id
    session.commit()
    return user


def delete_user(session: Session, admin: User, user_id: uuid.UUID) -> None:
    """A hard delete. The user is signed out at their next request, and can sign up again."""
    user = get_other_user(session, admin, user_id, "You can't delete your own account.")
    users_db.delete_user(session, user)
    session.commit()
