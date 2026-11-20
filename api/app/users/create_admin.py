"""Create the first Platform Admin from PLATFORM_ADMIN_* in api/.env.

Run from api/: uv run python -m app.users.create_admin
If the email already has an account, it's promoted and keeps its password.
"""

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import engine
from app.core.security import hash_password
from app.users import db as users_db
from app.users.models import User, UserRole


def create_admin(session: Session, email: str, password: str, name: str) -> User:
    email = email.strip().lower()  # stored lowercase, like sign-up does
    user = users_db.get_user_by_email(session, email)
    if user is None:
        user = users_db.add_user(session, User(name=name, email=email, password_hash=hash_password(password)))
    user.role = UserRole.PLATFORM_ADMIN
    user.building_id = None  # a Platform Admin reaches every building
    session.commit()
    return user


if __name__ == "__main__":
    if not settings.PLATFORM_ADMIN_EMAIL or not settings.PLATFORM_ADMIN_PASSWORD:
        raise SystemExit("Set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD in api/.env.")
    with Session(engine) as session:
        admin = create_admin(
            session, settings.PLATFORM_ADMIN_EMAIL, settings.PLATFORM_ADMIN_PASSWORD, settings.PLATFORM_ADMIN_NAME
        )
        print(f"{admin.email} is a Platform Admin.")
