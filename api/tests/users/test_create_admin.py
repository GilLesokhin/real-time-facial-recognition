from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.users.create_admin import create_admin
from app.users.models import UserRole
from tests.conftest import PASSWORD


def test_creates_a_new_platform_admin(session: Session):
    admin = create_admin(session, " Boss@Example.com ", "a-new-password", "Boss")

    assert admin.email == "boss@example.com"
    assert admin.role == UserRole.PLATFORM_ADMIN
    assert verify_password("a-new-password", admin.password_hash)


def test_promotes_an_existing_account_and_keeps_its_password(session: Session, make_user):
    existing = make_user("ana@example.com", UserRole.UNASSIGNED)

    admin = create_admin(session, "ana@example.com", "ignored-password", "Ignored")

    assert admin.id == existing.id
    assert admin.role == UserRole.PLATFORM_ADMIN
    assert verify_password(PASSWORD, admin.password_hash)


def test_promoting_a_building_admin_clears_their_building(session: Session, make_user, make_building):
    make_user("ana@example.com", UserRole.BUILDING_ADMIN, make_building())

    admin = create_admin(session, "ana@example.com", "ignored-password", "Ignored")

    assert admin.role == UserRole.PLATFORM_ADMIN
    assert admin.building_id is None
