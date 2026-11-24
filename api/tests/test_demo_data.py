from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.buildings.models import Building
from app.core.security import verify_password
from app.demo_data import DEMO_BUILDINGS, PHOTOS_DIR, add_demo_data
from app.people.models import Person
from app.terminals.models import Terminal
from app.users.models import User, UserRole
from tests.conftest import PASSWORD

MODELS = (Building, Terminal, User, Person)


def counts(session: Session) -> list[int]:
    return [session.scalar(select(func.count()).select_from(model)) for model in MODELS]


def test_every_photo_exists_and_is_different_within_a_building():
    for demo in DEMO_BUILDINGS:
        photos = [person.photo for person in demo.people]
        assert len(set(photos)) == len(photos)
        for photo in photos:
            assert (PHOTOS_DIR / photo).is_file()


def test_adds_buildings_terminals_admins_and_people(session: Session):
    added = add_demo_data(session, "demo-password")

    assert added.buildings == len(DEMO_BUILDINGS)
    assert added.terminals == sum(len(demo.terminals) for demo in DEMO_BUILDINGS)
    assert added.admins == len(DEMO_BUILDINGS)
    assert added.people == sum(len(demo.people) for demo in DEMO_BUILDINGS)

    demo = DEMO_BUILDINGS[0]
    admin = session.scalars(select(User).where(User.email == demo.admin_email)).one()
    building = session.get(Building, admin.building_id)
    assert building.name == demo.name
    assert admin.role == UserRole.BUILDING_ADMIN
    assert verify_password("demo-password", admin.password_hash)

    people = session.scalars(select(Person).where(Person.building_id == building.id)).all()
    assert sorted(person.name for person in people) == sorted(person.name for person in demo.people)


def test_second_run_adds_nothing(session: Session):
    add_demo_data(session, "demo-password")
    before = counts(session)

    added = add_demo_data(session, "demo-password")

    assert (added.buildings, added.terminals, added.admins, added.people) == (0, 0, 0, 0)
    assert counts(session) == before


def test_keeps_an_existing_account_as_it_is(session: Session, make_user):
    existing = make_user(DEMO_BUILDINGS[0].admin_email, UserRole.UNASSIGNED)

    add_demo_data(session, "demo-password")

    assert existing.role == UserRole.UNASSIGNED
    assert existing.building_id is None
    assert verify_password(PASSWORD, existing.password_hash)
