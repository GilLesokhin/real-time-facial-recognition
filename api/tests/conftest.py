import zlib
from collections.abc import Callable, Iterator
from pathlib import Path

import numpy as np
import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, make_url, text
from sqlalchemy.orm import Session

from app.buildings.models import Building
from app.core import faces
from app.core.config import settings
from app.core.db import get_session
from app.core.security import hash_password
from app.main import app
from app.people.models import EMBEDDING_SIZE, Person
from app.terminals.models import Terminal
from app.users.models import User, UserRole

PASSWORD = "correct-horse-battery"
ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


def create_database_if_missing(url: str) -> None:
    """Migrations run inside a database, so the test database itself is created here."""
    name = make_url(url).database
    server = create_engine(
        make_url(url).set(database="postgres"), isolation_level="AUTOCOMMIT"
    )
    with server.connect() as conn:
        exists = conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": name}
        )
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{name}"'))
    server.dispose()


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    """Once per test run: empty the test database and run every migration."""
    url = settings.TEST_DATABASE_URL
    if not url or url == settings.DATABASE_URL:
        raise RuntimeError("Set TEST_DATABASE_URL in api/.env to a separate database.")
    create_database_if_missing(url)
    engine = create_engine(url)
    with engine.begin() as conn:
        # Test database only: wipe everything so the migrations start from scratch.
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    config = Config(ALEMBIC_INI)
    config.attributes["database_url"] = url
    command.upgrade(config, "head")
    yield engine
    engine.dispose()


@pytest.fixture
def session(engine: Engine) -> Iterator[Session]:
    """A session inside a transaction that's rolled back after the test.

    A service's commit() only commits a savepoint, so nothing reaches the database.
    """
    with engine.connect() as conn:
        outer = conn.begin()
        session = Session(bind=conn, join_transaction_mode="create_savepoint")
        yield session
        session.close()
        outer.rollback()


@pytest.fixture
def client(session: Session) -> Iterator[TestClient]:
    """Calls the app, which uses the test's session instead of opening its own."""
    app.dependency_overrides[get_session] = lambda: session
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def make_user(session: Session) -> Callable[..., User]:
    def _make(email: str, role: UserRole = UserRole.PLATFORM_ADMIN, building: Building | None = None) -> User:
        building_id = building.id if building else None
        user = User(
            name=email.split("@")[0], email=email, password_hash=hash_password(PASSWORD), role=role, building_id=building_id
        )
        session.add(user)
        session.flush()
        return user

    return _make


@pytest.fixture
def make_building(session: Session) -> Callable[..., Building]:
    def _make(name: str = "North Tower") -> Building:
        building = Building(name=name, address="12 Herzl St")
        session.add(building)
        session.flush()
        return building

    return _make


@pytest.fixture
def make_terminal(session: Session) -> Callable[..., Terminal]:
    def _make(building: Building, name: str = "Main lobby") -> Terminal:
        terminal = Terminal(building_id=building.id, name=name)
        session.add(terminal)
        session.flush()
        return terminal

    return _make


@pytest.fixture
def make_person(session: Session) -> Callable[..., Person]:
    def _make(building: Building, name: str = "Dana Levi", face: str | None = None) -> Person:
        embedding = face_vector(face) if face else [0.0] * EMBEDDING_SIZE
        person = Person(building_id=building.id, name=name, apartment="4B", photo=b"jpeg", embedding=embedding)
        session.add(person)
        session.flush()
        return person

    return _make


def login(client: TestClient, email: str, password: str = PASSWORD):
    return client.post("/auth/login", json={"email": email, "password": password})


@pytest.fixture
def sign_in(client: TestClient, make_user) -> Callable[..., User]:
    """Creates an admin and signs the test client in as them."""

    def _sign_in(role: UserRole = UserRole.PLATFORM_ADMIN, building: Building | None = None, email: str | None = None) -> User:
        user = make_user(email or f"{role.value}@example.com", role, building)
        assert login(client, user.email).status_code == 200
        return user

    return _sign_in


# --- Fake faces ---
# The real models are slow and need face photos. In tests, an image's bytes say what it shows:
# b"face:ana" is Ana's face, and anything else has no face.


def face_vector(face: str) -> list[float]:
    """A random unit vector, the same every time for the same face. Two different faces are far apart."""
    vector = np.random.default_rng(zlib.crc32(face.encode())).standard_normal(EMBEDDING_SIZE)
    return (vector / np.linalg.norm(vector)).tolist()


def _fake_embed(data: bytes) -> list[float]:
    if not data.startswith(b"face:"):
        raise faces.NoFaceError("No face found in the photo.")
    return face_vector(data.decode())


@pytest.fixture(autouse=True)
def fake_faces(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(faces, "embed_face", _fake_embed)
    monkeypatch.setattr(faces, "prepare_photo", lambda data: (b"jpeg:" + data, _fake_embed(data)))
