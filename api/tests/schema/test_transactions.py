import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.buildings.models import Building
from app.core.db import CONFLICTS
from app.users import db as users_db
from app.users.models import User, UserRole
from tests.conftest import PASSWORD


def test_a_failed_write_leaves_nothing_behind(session: Session):
    """Atomic: the building and the bad user are one transaction, so neither is saved."""
    session.add(Building(name="North Tower", address="12 Herzl St"))
    session.flush()
    session.add(User(name="Ana", email="ana@example.com", password_hash="x", role=UserRole.BUILDING_ADMIN))

    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()

    assert session.scalars(select(Building).where(Building.name == "North Tower")).first() is None


def test_a_duplicate_the_service_misses_is_409(client: TestClient, monkeypatch):
    """Two sign-ups at once both pass the service's check. The unique index stops the second."""
    body = {"name": "Ana", "email": "ana@example.com", "password": PASSWORD}
    assert client.post("/auth/signup", json=body).status_code == 201
    monkeypatch.setattr(users_db, "get_user_by_email", lambda session, email: None)

    response = client.post("/auth/signup", json=body)

    assert response.status_code == 409
    assert response.json()["detail"] == CONFLICTS["uq_users_email"]
