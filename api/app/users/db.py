import uuid

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.users.models import User, UserRole


def get_user(session: Session, user_id: uuid.UUID) -> User | None:
    return session.get(User, user_id)


def get_user_by_email(session: Session, email: str) -> User | None:
    return session.scalars(select(User).where(func.lower(User.email) == email.lower())).first()


def list_users(session: Session, role: UserRole | None, building_id: uuid.UUID | None, search: str | None) -> list[User]:
    """Unassigned users first, since they wait for a decision. Then by name."""
    query = select(User)
    if role is not None:
        query = query.where(User.role == role)
    if building_id is not None:
        # Everyone who can manage the building: its Building Admins and every Platform Admin.
        query = query.where(or_(User.building_id == building_id, User.role == UserRole.PLATFORM_ADMIN))
    if search:
        query = query.where(or_(User.name.icontains(search, autoescape=True), User.email.icontains(search, autoescape=True)))
    unassigned_first = case((User.role == UserRole.UNASSIGNED, 0), else_=1)
    query = query.order_by(unassigned_first, func.lower(User.name), User.email)
    return list(session.scalars(query))


def add_user(session: Session, user: User) -> User:
    session.add(user)
    session.flush()  # sends the INSERT so id and created_at are filled in
    return user


def delete_user(session: Session, user: User) -> None:
    session.delete(user)
