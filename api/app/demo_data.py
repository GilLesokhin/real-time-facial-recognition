"""Add demo buildings, terminals, Building Admins and people, so the demo starts ready.

Run from api/: uv run python -m app.demo_data
Each demo admin gets PLATFORM_ADMIN_PASSWORD from api/.env.
Each person's face comes from a public-domain portrait in tests/fixtures/. Run app.faces.download_models first.
It skips anything that already exists, so it can run more than once.
"""

from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.orm import Session

from app.buildings import db as buildings_db
from app.buildings.models import Building
from app.core.config import settings
from app.core.db import engine
from app.core.security import hash_password
from app.faces.embedding import embed_for_enrollment
from app.people import db as people_db
from app.people.models import Person
from app.terminals import db as terminals_db
from app.terminals.models import Terminal
from app.users import db as users_db
from app.users.models import User, UserRole

PHOTOS_DIR = Path(__file__).resolve().parents[1] / "tests" / "fixtures"


@dataclass
class DemoPerson:
    name: str
    apartment: str
    photo: str


@dataclass
class DemoBuilding:
    name: str
    address: str
    terminals: list[str]
    admin_name: str
    admin_email: str
    people: list[DemoPerson]


# Within a building, each person has a different photo. Across buildings, the same photos come back with other names.
DEMO_BUILDINGS = [
    DemoBuilding(
        "Demo Plaza",
        "1 Demo Street",
        ["Main entrance", "Garage"],
        "Dana Levi",
        "demo.admin@example.com",
        [
            DemoPerson("Noam Shapiro", "1A", "armstrong_1.jpg"),
            DemoPerson("Maya Katz", "2B", "jemison.jpg"),
            DemoPerson("Yael Ben-David", "3C", "ride.jpg"),
            DemoPerson("Tamar Friedman", "4A", "ochoa.jpg"),
            DemoPerson("Avi Mizrahi", "5B", "glenn.jpg"),
        ],
    ),
    DemoBuilding(
        "Harbor Tower",
        "8 Harbor Road",
        ["Lobby", "Back door"],
        "Omer Cohen",
        "harbor.admin@example.com",
        [
            DemoPerson("Eitan Rosen", "101", "armstrong_1.jpg"),
            DemoPerson("Lior Peretz", "102", "jemison.jpg"),
            DemoPerson("Shira Goldberg", "201", "ride.jpg"),
            DemoPerson("Noa Azulay", "202", "ochoa.jpg"),
            DemoPerson("Ronen Biton", "301", "glenn.jpg"),
        ],
    ),
]


@dataclass
class Added:
    buildings: int = 0
    terminals: int = 0
    admins: int = 0
    people: int = 0


def add_demo_data(session: Session, admin_password: str) -> Added:
    added = Added()
    password_hash = hash_password(admin_password)

    for demo in DEMO_BUILDINGS:
        building = buildings_db.get_active_building_by_name(session, demo.name)
        if building is None:
            building = buildings_db.add_building(session, Building(name=demo.name, address=demo.address))
            added.buildings += 1

        for terminal_name in demo.terminals:
            if terminals_db.get_active_terminal_by_name(session, building.id, terminal_name) is None:
                terminals_db.add_terminal(session, Terminal(building_id=building.id, name=terminal_name))
                added.terminals += 1

        # An existing account keeps its role, building and password.
        if users_db.get_user_by_email(session, demo.admin_email) is None:
            admin = User(
                name=demo.admin_name,
                email=demo.admin_email,
                password_hash=password_hash,
                role=UserRole.BUILDING_ADMIN,
                building_id=building.id,
            )
            users_db.add_user(session, admin)
            added.admins += 1

        for demo_person in demo.people:
            if people_db.get_active_person_by_name(session, building.id, demo_person.name) is None:
                embedding = embed_for_enrollment((PHOTOS_DIR / demo_person.photo).read_bytes())
                person = Person(
                    building_id=building.id, name=demo_person.name, apartment=demo_person.apartment, embedding=embedding
                )
                people_db.add_person(session, person)
                added.people += 1

    session.commit()
    return added


if __name__ == "__main__":
    if not settings.PLATFORM_ADMIN_PASSWORD:
        raise SystemExit("Set PLATFORM_ADMIN_PASSWORD in api/.env. The demo admins use it.")
    with Session(engine) as session:
        added = add_demo_data(session, settings.PLATFORM_ADMIN_PASSWORD)
    print(
        f"Added {added.buildings} buildings, {added.terminals} terminals, "
        f"{added.admins} admins and {added.people} people."
    )
    print("Demo admins sign in with PLATFORM_ADMIN_PASSWORD:")
    for demo in DEMO_BUILDINGS:
        print(f"  {demo.admin_email} ({demo.name})")
