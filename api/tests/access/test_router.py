from datetime import UTC, datetime, timedelta
from pathlib import Path

import cv2
import numpy as np
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.access.db import ACCESS_LOG_LIMIT
from app.access.models import AccessEvent, AccessResult
from app.access.service import MATCH_THRESHOLD
from app.core.security import terminal_key
from app.faces.embedding import embed_for_enrollment
from app.faces.upload import MAX_PHOTO_BYTES
from app.users.models import UserRole
from tests.conftest import login

PLATFORM = "platform@example.com"
BUILDING_ADMIN = "building@example.com"

# NASA portraits from Wikimedia Commons (public domain), cropped like the browser does.
FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
ARMSTRONG = (FIXTURES / "armstrong_1.jpg").read_bytes()
ARMSTRONG_AGAIN = (FIXTURES / "armstrong_2.jpg").read_bytes()
JEMISON = (FIXTURES / "jemison.jpg").read_bytes()
NO_FACE = cv2.imencode(".png", np.full((320, 320, 3), 128, np.uint8))[1].tobytes()


def as_platform_admin(client: TestClient, make_user) -> None:
    make_user(PLATFORM)
    login(client, PLATFORM)


def bearer(terminal) -> dict[str, str]:
    return {"Authorization": f"Bearer {terminal_key(terminal.id)}"}


def photo(data: bytes) -> dict:
    return {"photo": ("face.jpg", data, "image/jpeg")}


def enroll(session: Session, make_person, building, face: bytes, name: str = "Neil Armstrong"):
    person = make_person(building, name)
    person.embedding = embed_for_enrollment(face)
    session.flush()
    return person


def identify(client: TestClient, terminal, data: bytes):
    return client.post(f"/terminals/{terminal.id}/identify", files=photo(data), headers=bearer(terminal))


def logged_events(session: Session, terminal) -> list[AccessEvent]:
    return list(session.scalars(select(AccessEvent).where(AccessEvent.terminal_id == terminal.id)))


def add_event(session: Session, terminal, result: AccessResult, at: datetime, person=None) -> None:
    person_id = person.id if person else None
    event = AccessEvent(
        building_id=terminal.building_id, terminal_id=terminal.id, person_id=person_id, result=result, created_at=at
    )
    session.add(event)
    session.flush()


# --- Identify ---


def test_enrolled_face_is_granted_and_logged(
    client: TestClient, session: Session, make_building, make_terminal, make_person
):
    building = make_building()
    terminal = make_terminal(building)
    person = enroll(session, make_person, building, ARMSTRONG)

    response = identify(client, terminal, ARMSTRONG_AGAIN)

    assert response.status_code == 200
    assert response.json() == {"result": "granted", "person_name": "Neil Armstrong"}
    [event] = logged_events(session, terminal)
    assert event.result == AccessResult.GRANTED
    assert event.person_id == person.id
    assert event.building_id == building.id
    assert event.score > MATCH_THRESHOLD


def test_unknown_face_is_denied_and_logged_with_its_score(
    client: TestClient, session: Session, make_building, make_terminal, make_person
):
    building = make_building()
    terminal = make_terminal(building)
    enroll(session, make_person, building, JEMISON, "Mae Jemison")

    response = identify(client, terminal, ARMSTRONG)

    assert response.json() == {"result": "denied", "person_name": None}
    [event] = logged_events(session, terminal)
    assert event.result == AccessResult.DENIED
    assert event.person_id is None
    assert event.score is not None
    assert event.score <= MATCH_THRESHOLD


def test_with_no_one_enrolled_it_is_denied_with_no_score(client: TestClient, session: Session, make_building, make_terminal):
    terminal = make_terminal(make_building())

    response = identify(client, terminal, ARMSTRONG)

    assert response.json() == {"result": "denied", "person_name": None}
    [event] = logged_events(session, terminal)
    assert event.score is None


def test_no_face_is_denied_with_no_score(client: TestClient, session: Session, make_building, make_terminal, make_person):
    building = make_building()
    terminal = make_terminal(building)
    enroll(session, make_person, building, ARMSTRONG)

    response = identify(client, terminal, NO_FACE)

    assert response.json() == {"result": "denied", "person_name": None}
    [event] = logged_events(session, terminal)
    assert event.result == AccessResult.DENIED
    assert event.score is None


def test_a_file_that_isnt_an_image_is_422_and_not_logged(
    client: TestClient, session: Session, make_building, make_terminal
):
    terminal = make_terminal(make_building())

    response = identify(client, terminal, b"not an image")

    assert response.status_code == 422
    assert logged_events(session, terminal) == []


def test_a_photo_over_1_mb_is_413_and_not_logged(client: TestClient, session: Session, make_building, make_terminal):
    terminal = make_terminal(make_building())

    response = identify(client, terminal, ARMSTRONG + b"\0" * MAX_PHOTO_BYTES)

    assert response.status_code == 413
    assert logged_events(session, terminal) == []


def test_removed_person_is_denied(client: TestClient, session: Session, make_building, make_terminal, make_person):
    building = make_building()
    terminal = make_terminal(building)
    person = enroll(session, make_person, building, ARMSTRONG)
    person.is_active = False
    session.flush()

    assert identify(client, terminal, ARMSTRONG_AGAIN).json() == {"result": "denied", "person_name": None}


def test_another_buildings_person_is_denied(
    client: TestClient, session: Session, make_building, make_terminal, make_person
):
    terminal = make_terminal(make_building("North Tower"))
    enroll(session, make_person, make_building("Cedar Court"), ARMSTRONG)

    assert identify(client, terminal, ARMSTRONG_AGAIN).json() == {"result": "denied", "person_name": None}


def test_admin_cookie_cant_act_as_a_terminal(
    client: TestClient, session: Session, make_user, make_building, make_terminal, make_person
):
    building = make_building()
    terminal = make_terminal(building)
    enroll(session, make_person, building, ARMSTRONG)
    as_platform_admin(client, make_user)

    response = client.post(f"/terminals/{terminal.id}/identify", files=photo(ARMSTRONG_AGAIN))

    assert response.status_code == 401
    assert logged_events(session, terminal) == []


# --- Access log ---


def test_log_needs_sign_in(client: TestClient, make_building):
    building = make_building()
    assert client.get(f"/buildings/{building.id}/access-log").status_code == 401


def test_building_admin_cant_read_another_buildings_log(client: TestClient, make_user, make_building):
    own = make_building("North Tower")
    other = make_building("Cedar Court")
    make_user(BUILDING_ADMIN, UserRole.BUILDING_ADMIN, own)
    login(client, BUILDING_ADMIN)

    assert client.get(f"/buildings/{other.id}/access-log").status_code == 404


def test_log_is_newest_first_with_names(
    client: TestClient, session: Session, make_user, make_building, make_terminal, make_person
):
    building = make_building()
    lobby = make_terminal(building, "Lobby")
    person = make_person(building, "Dana Levi")
    add_event(session, lobby, AccessResult.DENIED, datetime(2026, 11, 1, 9, 0, tzinfo=UTC))
    add_event(session, lobby, AccessResult.GRANTED, datetime(2026, 11, 1, 10, 0, tzinfo=UTC), person)
    as_platform_admin(client, make_user)

    response = client.get(f"/buildings/{building.id}/access-log")

    assert response.status_code == 200
    newest, oldest = response.json()
    assert newest["result"] == "granted"
    assert newest["person_name"] == "Dana Levi"
    assert newest["terminal_name"] == "Lobby"
    assert newest["created_at"].startswith("2026-11-01T10:00:00")
    assert oldest["result"] == "denied"
    assert oldest["person_name"] is None


def test_log_keeps_names_of_removed_people_and_terminals(
    client: TestClient, session: Session, make_user, make_building, make_terminal, make_person
):
    building = make_building()
    lobby = make_terminal(building, "Lobby")
    person = make_person(building, "Dana Levi")
    add_event(session, lobby, AccessResult.GRANTED, datetime(2026, 11, 1, 10, 0, tzinfo=UTC), person)
    lobby.is_active = False
    person.is_active = False
    session.flush()
    as_platform_admin(client, make_user)

    [event] = client.get(f"/buildings/{building.id}/access-log").json()

    assert event["person_name"] == "Dana Levi"
    assert event["terminal_name"] == "Lobby"


def test_log_filters_by_terminal_and_result(
    client: TestClient, session: Session, make_user, make_building, make_terminal, make_person
):
    building = make_building()
    lobby = make_terminal(building, "Lobby")
    garage = make_terminal(building, "Garage")
    person = make_person(building)
    at = datetime(2026, 11, 1, 10, 0, tzinfo=UTC)
    add_event(session, lobby, AccessResult.GRANTED, at, person)
    add_event(session, lobby, AccessResult.DENIED, at)
    add_event(session, garage, AccessResult.DENIED, at)
    as_platform_admin(client, make_user)
    url = f"/buildings/{building.id}/access-log"

    by_terminal = client.get(url, params={"terminal": str(lobby.id)}).json()
    by_result = client.get(url, params={"result": "denied"}).json()
    by_both = client.get(url, params={"terminal": str(lobby.id), "result": "denied"}).json()

    assert {event["terminal_name"] for event in by_terminal} == {"Lobby"}
    assert len(by_terminal) == 2
    assert {event["result"] for event in by_result} == {"denied"}
    assert len(by_result) == 2
    assert len(by_both) == 1


def test_log_shows_only_its_own_building(client: TestClient, session: Session, make_user, make_building, make_terminal):
    building = make_building("North Tower")
    other = make_building("Cedar Court")
    at = datetime(2026, 11, 1, 10, 0, tzinfo=UTC)
    add_event(session, make_terminal(building), AccessResult.DENIED, at)
    other_terminal = make_terminal(other)
    add_event(session, other_terminal, AccessResult.DENIED, at)
    as_platform_admin(client, make_user)
    url = f"/buildings/{building.id}/access-log"

    assert len(client.get(url).json()) == 1
    assert client.get(url, params={"terminal": str(other_terminal.id)}).json() == []


def test_log_shows_only_the_newest_100(client: TestClient, session: Session, make_user, make_building, make_terminal):
    building = make_building()
    terminal = make_terminal(building)
    start = datetime(2026, 11, 1, tzinfo=UTC)
    for minute in range(ACCESS_LOG_LIMIT + 1):
        add_event(session, terminal, AccessResult.DENIED, start + timedelta(minutes=minute))
    as_platform_admin(client, make_user)

    events = client.get(f"/buildings/{building.id}/access-log").json()

    assert len(events) == ACCESS_LOG_LIMIT
    assert events[-1]["created_at"].startswith("2026-11-01T00:01:00")
