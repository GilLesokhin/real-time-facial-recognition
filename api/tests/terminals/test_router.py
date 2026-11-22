from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.access.models import AccessEvent, AccessResult
from app.core.security import terminal_key
from app.users.models import UserRole
from tests.conftest import login

PLATFORM = "platform@example.com"
BUILDING_ADMIN = "building@example.com"
NO_ID = "00000000-0000-0000-0000-000000000000"


def as_platform_admin(client: TestClient, make_user) -> None:
    make_user(PLATFORM)
    login(client, PLATFORM)


def as_building_admin(client: TestClient, make_user, building) -> None:
    make_user(BUILDING_ADMIN, UserRole.BUILDING_ADMIN, building)
    login(client, BUILDING_ADMIN)


def bearer(terminal) -> dict[str, str]:
    return {"Authorization": f"Bearer {terminal_key(terminal.id)}"}


def names(response) -> list[str]:
    return [terminal["name"] for terminal in response.json()]


def add_event(session: Session, terminal, result: AccessResult, at: datetime, person=None) -> None:
    person_id = person.id if person else None
    event = AccessEvent(
        building_id=terminal.building_id, terminal_id=terminal.id, person_id=person_id, result=result, created_at=at
    )
    session.add(event)
    session.flush()


# --- Who can call the admin endpoints ---


def test_admin_endpoints_need_sign_in(client: TestClient, make_building, make_terminal):
    building = make_building()
    terminal = make_terminal(building)
    assert client.get(f"/buildings/{building.id}/terminals").status_code == 401
    assert client.post(f"/buildings/{building.id}/terminals", json={"name": "Garage"}).status_code == 401
    assert client.patch(f"/terminals/{terminal.id}", json={"name": "Garage"}).status_code == 401
    assert client.delete(f"/terminals/{terminal.id}").status_code == 401
    assert client.get(f"/terminals/{terminal.id}/key").status_code == 401


def test_building_admin_cant_reach_another_buildings_terminals(client: TestClient, make_user, make_building, make_terminal):
    mine = make_building("North Tower")
    other = make_building("Cedar Court")
    terminal = make_terminal(other)
    as_building_admin(client, make_user, mine)
    assert client.get(f"/buildings/{other.id}/terminals").status_code == 404
    assert client.post(f"/buildings/{other.id}/terminals", json={"name": "Garage"}).status_code == 404
    assert client.patch(f"/terminals/{terminal.id}", json={"name": "Garage"}).status_code == 404
    assert client.delete(f"/terminals/{terminal.id}").status_code == 404
    assert client.get(f"/terminals/{terminal.id}/key").status_code == 404


def test_building_admin_manages_own_buildings_terminals(client: TestClient, make_user, make_building, make_terminal):
    mine = make_building()
    terminal = make_terminal(mine)
    as_building_admin(client, make_user, mine)
    assert names(client.get(f"/buildings/{mine.id}/terminals")) == ["Main lobby"]
    assert client.post(f"/buildings/{mine.id}/terminals", json={"name": "Garage"}).status_code == 201
    assert client.patch(f"/terminals/{terminal.id}", json={"name": "Lobby"}).status_code == 200
    assert client.get(f"/terminals/{terminal.id}/key").status_code == 200
    assert client.delete(f"/terminals/{terminal.id}").status_code == 204


# --- GET /buildings/{id}/terminals ---


def test_lists_active_terminals_by_name(client: TestClient, session: Session, make_user, make_building, make_terminal):
    building = make_building()
    other = make_building("Cedar Court")
    make_terminal(building, "Main lobby")
    make_terminal(building, "garage")
    removed = make_terminal(building, "Back door")
    removed.is_active = False
    make_terminal(other, "Other lobby")
    session.flush()
    as_platform_admin(client, make_user)

    response = client.get(f"/buildings/{building.id}/terminals")
    assert response.status_code == 200
    assert names(response) == ["garage", "Main lobby"]
    assert set(response.json()[0]) == {"id", "building_id", "name"}


# GIL-79 (Identify + access log): uncomment with latest_event.
# def test_list_shows_each_terminals_newest_event(
#     client: TestClient, session: Session, make_user, make_building, make_terminal, make_person
# ):
#     building = make_building()
#     lobby = make_terminal(building, "Lobby")
#     make_terminal(building, "Garage")
#     add_event(session, lobby, AccessResult.DENIED, datetime(2026, 11, 1, 9, 0, tzinfo=UTC))
#     add_event(session, lobby, AccessResult.GRANTED, datetime(2026, 11, 1, 10, 0, tzinfo=UTC), make_person(building))
#     as_platform_admin(client, make_user)
#
#     by_name = {terminal["name"]: terminal for terminal in client.get(f"/buildings/{building.id}/terminals").json()}
#     assert by_name["Lobby"]["latest_event"]["result"] == "granted"
#     assert by_name["Lobby"]["latest_event"]["created_at"].startswith("2026-11-01T10:00:00")
#     assert by_name["Garage"]["latest_event"] is None


def test_list_of_unknown_or_deactivated_building_is_404(client: TestClient, session: Session, make_user, make_building):
    closed = make_building()
    closed.is_active = False
    session.flush()
    as_platform_admin(client, make_user)
    assert client.get(f"/buildings/{closed.id}/terminals").status_code == 404
    assert client.get(f"/buildings/{NO_ID}/terminals").status_code == 404


# --- POST /buildings/{id}/terminals ---


def test_adds_terminal(client: TestClient, make_user, make_building):
    building = make_building()
    as_platform_admin(client, make_user)
    response = client.post(f"/buildings/{building.id}/terminals", json={"name": "  Main lobby "})
    assert response.status_code == 201
    assert response.json()["name"] == "Main lobby"  # trimmed
    assert response.json()["building_id"] == str(building.id)
    assert names(client.get(f"/buildings/{building.id}/terminals")) == ["Main lobby"]


def test_add_rejects_empty_name(client: TestClient, make_user, make_building):
    building = make_building()
    as_platform_admin(client, make_user)
    assert client.post(f"/buildings/{building.id}/terminals", json={"name": "  "}).status_code == 422


def test_add_rejects_taken_name_ignoring_case(client: TestClient, make_user, make_building, make_terminal):
    building = make_building()
    make_terminal(building, "Main lobby")
    as_platform_admin(client, make_user)
    response = client.post(f"/buildings/{building.id}/terminals", json={"name": "MAIN LOBBY"})
    assert response.status_code == 409
    assert response.json()["detail"] == "A terminal with this name already exists."


def test_add_allows_same_name_in_another_building(client: TestClient, make_user, make_building, make_terminal):
    make_terminal(make_building("North Tower"), "Main lobby")
    other = make_building("Cedar Court")
    as_platform_admin(client, make_user)
    assert client.post(f"/buildings/{other.id}/terminals", json={"name": "Main lobby"}).status_code == 201


def test_add_allows_name_of_removed_terminal(client: TestClient, session: Session, make_user, make_building, make_terminal):
    building = make_building()
    old = make_terminal(building, "Main lobby")
    old.is_active = False
    session.flush()
    as_platform_admin(client, make_user)
    assert client.post(f"/buildings/{building.id}/terminals", json={"name": "Main lobby"}).status_code == 201


# --- PATCH /terminals/{id} ---


def test_renames_terminal(client: TestClient, make_user, make_building, make_terminal):
    building = make_building()
    terminal = make_terminal(building, "Main lobby")
    as_platform_admin(client, make_user)
    response = client.patch(f"/terminals/{terminal.id}", json={"name": "Front door"})
    assert response.status_code == 200
    assert response.json() == {"id": str(terminal.id), "building_id": str(building.id), "name": "Front door"}


def test_rename_can_change_case_of_own_name(client: TestClient, make_user, make_building, make_terminal):
    terminal = make_terminal(make_building(), "Main lobby")
    as_platform_admin(client, make_user)
    assert client.patch(f"/terminals/{terminal.id}", json={"name": "MAIN LOBBY"}).status_code == 200


def test_rename_rejects_name_of_another_terminal(client: TestClient, make_user, make_building, make_terminal):
    building = make_building()
    make_terminal(building, "Main lobby")
    garage = make_terminal(building, "Garage")
    as_platform_admin(client, make_user)
    assert client.patch(f"/terminals/{garage.id}", json={"name": "main lobby"}).status_code == 409


def test_rename_unknown_terminal_is_404(client: TestClient, make_user):
    as_platform_admin(client, make_user)
    assert client.patch(f"/terminals/{NO_ID}", json={"name": "X"}).status_code == 404


# --- DELETE /terminals/{id} ---


def test_remove_deactivates_and_keeps_past_checks(
    client: TestClient, session: Session, make_user, make_building, make_terminal
):
    building = make_building()
    terminal = make_terminal(building)
    add_event(session, terminal, AccessResult.DENIED, datetime(2026, 11, 1, tzinfo=UTC))
    as_platform_admin(client, make_user)

    assert client.delete(f"/terminals/{terminal.id}").status_code == 204

    session.refresh(terminal)
    assert not terminal.is_active
    assert session.query(AccessEvent).filter_by(terminal_id=terminal.id).count() == 1
    assert names(client.get(f"/buildings/{building.id}/terminals")) == []


def test_remove_twice_is_404(client: TestClient, make_user, make_building, make_terminal):
    terminal = make_terminal(make_building())
    as_platform_admin(client, make_user)
    client.delete(f"/terminals/{terminal.id}")
    assert client.delete(f"/terminals/{terminal.id}").status_code == 404


# --- GET /terminals/{id}/key ---


def test_key_comes_with_the_names_the_door_shows(client: TestClient, make_user, make_building, make_terminal):
    building = make_building("North Tower")
    terminal = make_terminal(building, "Main lobby")
    as_platform_admin(client, make_user)
    response = client.get(f"/terminals/{terminal.id}/key")
    assert response.status_code == 200
    assert response.json() == {
        "id": str(terminal.id),
        "building_id": str(building.id),
        "name": "Main lobby",
        "building_name": "North Tower",
        "key": terminal_key(terminal.id),
    }


def test_each_terminal_has_its_own_key(make_building, make_terminal):
    building = make_building()
    assert terminal_key(make_terminal(building, "A").id) != terminal_key(make_terminal(building, "B").id)


def test_key_of_removed_terminal_or_deactivated_building_is_404(
    client: TestClient, session: Session, make_user, make_building, make_terminal
):
    removed = make_terminal(make_building("North Tower"))
    removed.is_active = False
    closed = make_building("Cedar Court")
    in_closed = make_terminal(closed)
    closed.is_active = False
    session.flush()
    as_platform_admin(client, make_user)
    assert client.get(f"/terminals/{removed.id}/key").status_code == 404
    assert client.get(f"/terminals/{in_closed.id}/key").status_code == 404


def test_terminal_key_cant_get_a_key(client: TestClient, make_building, make_terminal):
    terminal = make_terminal(make_building())
    assert client.get(f"/terminals/{terminal.id}/key", headers=bearer(terminal)).status_code == 401
