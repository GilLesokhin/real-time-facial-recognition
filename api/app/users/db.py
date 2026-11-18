import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.users.models import User, UserRole


def get_user(session: Session, user_id: uuid.UUID) -> User | None:
    return session.get(User, user_id)


def get_user_by_email(session: Session, email: str) -> User | None:
    return session.scalars(select(User).where(func.lower(User.email) == email.lower())).first()


def add_user(session: Session, user: User) -> User:
    session.add(user)
    session.flush()  # sends the INSERT so id and created_at are filled in
    return user


def list_users(
    session: Session, role: UserRole | None, building_id: uuid.UUID | None, q: str | None
) -> list[User]:
    query = select(User)
    if role:
        query = query.where(User.role == role)
    if building_id:
        # Who can manage the building: its Building Admins and every Platform Admin.
        query = query.where(or_(User.building_id == building_id, User.role == UserRole.PLATFORM_ADMIN))
    if q:
        pattern = f"%{q.lower()}%"
        query = query.where(or_(func.lower(User.name).like(pattern), func.lower(User.email).like(pattern)))
    # Unassigned first (they need a decision), then by name.
    return list(session.scalars(query.order_by((User.role != UserRole.UNASSIGNED), func.lower(User.name))))


def delete_user(session: Session, user: User) -> None:
    session.delete(user)
    session.flush()
