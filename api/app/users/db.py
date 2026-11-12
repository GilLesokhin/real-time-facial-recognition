import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.users.models import User


def get_user(session: Session, user_id: uuid.UUID) -> User | None:
    return session.get(User, user_id)


def get_user_by_email(session: Session, email: str) -> User | None:
    return session.scalars(select(User).where(User.email == email)).first()


def add_user(session: Session, user: User) -> User:
    session.add(user)
    session.flush()  # sends the INSERT so id and created_at are filled in
    return user
