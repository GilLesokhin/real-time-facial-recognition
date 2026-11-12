from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_session
from app.core.security import hash_password
from app.main import app
from app.users.models import User, UserRole

PASSWORD = "correct-horse-battery"
ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    """Once per test run: empty the test database and run every migration."""
    url = settings.TEST_DATABASE_URL
    if not url or url == settings.DATABASE_URL:
        raise RuntimeError("Set TEST_DATABASE_URL in api/.env to a separate database.")
    engine = create_engine(url)
    with engine.begin() as conn:
        # Test database only: wipe everything so the migrations start from scratch.
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    config = Config(ALEMBIC_INI)
    config.attributes["database_url"] = url
    config.attributes["skip_seed"] = True  # tests create their own users
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
    def _make(email: str, role: UserRole = UserRole.BUILDING_ADMIN) -> User:
        user = User(name=email.split("@")[0], email=email, password_hash=hash_password(PASSWORD), role=role)
        session.add(user)
        session.flush()
        return user

    return _make


def login(client: TestClient, email: str, password: str = PASSWORD):
    return client.post("/auth/login", json={"email": email, "password": password})
