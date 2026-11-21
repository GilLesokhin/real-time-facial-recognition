from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.security import DUMMY_HASH, hash_password, verify_password
from app.users import db as users_db
from app.users.models import User, UserRole


def sign_up(session: Session, name: str, email: str, password: str) -> User:
    email = email.lower()
    if users_db.get_user_by_email(session, email):
        raise HTTPException(409, "An account with this email already exists.")
    user = users_db.add_user(session, User(name=name, email=email, password_hash=hash_password(password)))
    session.commit()
    return user


def log_in(session: Session, email: str, password: str) -> User:
    user = users_db.get_user_by_email(session, email.lower())
    # Always check a hash, even for unknown emails, so both failures take the same time.
    password_hash = user.password_hash if user else DUMMY_HASH
    if not verify_password(password, password_hash) or user is None:
        raise HTTPException(401, "Wrong email or password.")
    # Only after the password is right, so this doesn't reveal which emails exist.
    if user.role == UserRole.UNASSIGNED:
        raise HTTPException(403, "Your account doesn't have access yet. A Platform Admin needs to give you a role.")
    return user
