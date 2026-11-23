"""The guard for `/buildings/{building_id}/...` routes, called directly.

Later features (people, terminals, access log) use it for every building in a URL.
"""

import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.buildings.deps import manageable_building
from app.users.models import UserRole


def assert_refused(session: Session, building_id: uuid.UUID, admin) -> None:
    with pytest.raises(HTTPException) as error:
        manageable_building(building_id, admin, session)
    assert error.value.status_code == 404


def test_platform_admin_manages_any_active_building(session: Session, make_user, make_building):
    admin = make_user("platform@example.com")
    building = make_building()
    assert manageable_building(building.id, admin, session) == building


def test_building_admin_manages_their_building(session: Session, make_user, make_building):
    mine = make_building()
    admin = make_user("building@example.com", UserRole.BUILDING_ADMIN, mine)
    assert manageable_building(mine.id, admin, session) == mine


def test_building_admin_is_refused_another_building(session: Session, make_user, make_building):
    mine = make_building("North Tower")
    other = make_building("Cedar Court")
    admin = make_user("building@example.com", UserRole.BUILDING_ADMIN, mine)
    assert_refused(session, other.id, admin)


def test_deactivated_building_is_refused_to_everyone(session: Session, make_user, make_building):
    building = make_building()
    platform = make_user("platform@example.com")
    building_admin = make_user("building@example.com", UserRole.BUILDING_ADMIN, building)
    building.is_active = False
    session.flush()
    assert_refused(session, building.id, platform)
    assert_refused(session, building.id, building_admin)


def test_unknown_building_is_refused(session: Session, make_user):
    admin = make_user("platform@example.com")
    assert_refused(session, uuid.uuid4(), admin)
