import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.buildings import db as buildings_db
from app.users import db
from app.users.models import User, UserRole


def _other_user(session: Session, admin: User, user_id: uuid.UUID, action: str) -> User:
    user = db.get_user(session, user_id)
    if user is None:
        raise HTTPException(404, "User not found.")
    if user.id == admin.id:
        raise HTTPException(400, f"You can't {action} your own account.")
    return user


def list_users(
    session: Session, role: UserRole | None, building_id: uuid.UUID | None, q: str | None
) -> list[User]:
    return db.list_users(session, role, building_id, q.strip() if q else None)


def set_access(
    session: Session, admin: User, user_id: uuid.UUID, role: UserRole, building_id: uuid.UUID | None
) -> User:
    """A Building Admin has exactly one building. Nobody else has one."""
    user = _other_user(session, admin, user_id, "change the role of")
    if role == UserRole.BUILDING_ADMIN:
        if building_id is None:
            raise HTTPException(422, "A Building Admin needs a building.")
        if buildings_db.get_active_building(session, building_id) is None:
            raise HTTPException(422, "That building doesn't exist.")
    elif building_id is not None:
        raise HTTPException(422, "Only a Building Admin has a building.")
    user.role = role
    user.building_id = building_id
    session.commit()
    return user


def delete_user(session: Session, admin: User, user_id: uuid.UUID) -> None:
    user = _other_user(session, admin, user_id, "delete")
    db.delete_user(session, user)
    session.commit()
