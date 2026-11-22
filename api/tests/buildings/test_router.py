from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.users.models import UserRole
from tests.conftest import login

PLATFORM = "platform@example.com"
BUILDING_ADMIN = "building@example.com"


def as_platform_admin(client: TestClient, make_user) -> None:
    make_user(PLATFORM)
    login(client, PLATFORM)


def as_building_admin(client: TestClient, make_user, building) -> None:
    make_user(BUILDING_ADMIN, UserRole.BUILDING_ADMIN, building)
    login(client, BUILDING_ADMIN)


# --- GET /buildings ---


def test_list_needs_sign_in(client: TestClient):
    assert client.get("/buildings").status_code == 401


def test_platform_admin_lists_all_active_buildings_by_name(client: TestClient, session: Session, make_user, make_building):
    make_building("North Tower")
    make_building("cedar Court")
    closed = make_building("Old Mill")
    closed.is_active = False
    session.flush()
    as_platform_admin(client, make_user)

    response = client.get("/buildings")
    assert response.status_code == 200
    assert [building["name"] for building in response.json()] == ["cedar Court", "North Tower"]
    assert set(response.json()[0]) == {"id", "name", "address"}


def test_building_admin_lists_only_their_building(client: TestClient, make_user, make_building):
    mine = make_building("North Tower")
    make_building("Cedar Court")
    as_building_admin(client, make_user, mine)

    response = client.get("/buildings")
    assert [building["id"] for building in response.json()] == [str(mine.id)]


def test_building_admin_of_deactivated_building_lists_nothing(client: TestClient, session: Session, make_user, make_building):
    mine = make_building()
    mine.is_active = False
    session.flush()
    as_building_admin(client, make_user, mine)
    assert client.get("/buildings").json() == []


def test_me_returns_building_id(client: TestClient, make_user, make_building):
    mine = make_building()
    as_building_admin(client, make_user, mine)
    assert client.get("/auth/me").json()["building_id"] == str(mine.id)


# --- POST /buildings ---


def test_platform_admin_adds_building(client: TestClient, make_user):
    as_platform_admin(client, make_user)
    response = client.post("/buildings", json={"name": "  North Tower ", "address": "12 Herzl St"})
    assert response.status_code == 201
    assert response.json()["name"] == "North Tower"  # trimmed
    assert [building["name"] for building in client.get("/buildings").json()] == ["North Tower"]


def test_add_rejects_empty_name(client: TestClient, make_user):
    as_platform_admin(client, make_user)
    assert client.post("/buildings", json={"name": "  ", "address": ""}).status_code == 422


def test_add_rejects_taken_name_ignoring_case(client: TestClient, make_user, make_building):
    make_building("North Tower")
    as_platform_admin(client, make_user)
    response = client.post("/buildings", json={"name": "north tower", "address": ""})
    assert response.status_code == 409
    assert response.json()["detail"] == "A building with this name already exists."


def test_add_allows_name_of_deactivated_building(client: TestClient, session: Session, make_user, make_building):
    old = make_building("North Tower")
    old.is_active = False
    session.flush()
    as_platform_admin(client, make_user)
    assert client.post("/buildings", json={"name": "North Tower", "address": ""}).status_code == 201


def test_building_admin_cannot_add(client: TestClient, make_user, make_building):
    as_building_admin(client, make_user, make_building())
    assert client.post("/buildings", json={"name": "New", "address": ""}).status_code == 403


# --- PATCH /buildings/{id} ---


def test_platform_admin_edits_building(client: TestClient, make_user, make_building):
    building = make_building("North Tower")
    as_platform_admin(client, make_user)
    response = client.patch(f"/buildings/{building.id}", json={"address": "1 New St"})
    assert response.status_code == 200
    assert response.json() == {"id": str(building.id), "name": "North Tower", "address": "1 New St"}


def test_edit_can_change_case_of_own_name(client: TestClient, make_user, make_building):
    building = make_building("North Tower")
    as_platform_admin(client, make_user)
    assert client.patch(f"/buildings/{building.id}", json={"name": "NORTH TOWER"}).status_code == 200


def test_edit_rejects_name_of_another_building(client: TestClient, make_user, make_building):
    make_building("North Tower")
    other = make_building("Cedar Court")
    as_platform_admin(client, make_user)
    assert client.patch(f"/buildings/{other.id}", json={"name": "north tower"}).status_code == 409


def test_edit_unknown_or_deactivated_building_is_404(client: TestClient, session: Session, make_user, make_building):
    closed = make_building()
    closed.is_active = False
    session.flush()
    as_platform_admin(client, make_user)
    assert client.patch(f"/buildings/{closed.id}", json={"name": "X"}).status_code == 404
    assert client.patch("/buildings/00000000-0000-0000-0000-000000000000", json={"name": "X"}).status_code == 404


def test_building_admin_cannot_edit_even_own_building(client: TestClient, make_user, make_building):
    mine = make_building()
    as_building_admin(client, make_user, mine)
    assert client.patch(f"/buildings/{mine.id}", json={"name": "X"}).status_code == 403


# --- DELETE /buildings/{id} ---


def test_delete_deactivates_building_terminals_and_people(
    client: TestClient, session: Session, make_user, make_building, make_terminal, make_person
):
    building = make_building()
    other = make_building("Cedar Court")
    terminal = make_terminal(building)
    person = make_person(building)
    other_terminal = make_terminal(other)
    as_platform_admin(client, make_user)

    assert client.delete(f"/buildings/{building.id}").status_code == 204

    session.refresh(building)
    session.refresh(terminal)
    session.refresh(person)
    session.refresh(other_terminal)
    assert not building.is_active
    assert not terminal.is_active
    assert not person.is_active
    assert other_terminal.is_active
    assert [building["name"] for building in client.get("/buildings").json()] == ["Cedar Court"]


def test_delete_twice_is_404(client: TestClient, make_user, make_building):
    building = make_building()
    as_platform_admin(client, make_user)
    client.delete(f"/buildings/{building.id}")
    assert client.delete(f"/buildings/{building.id}").status_code == 404


def test_building_admin_cannot_delete(client: TestClient, make_user, make_building):
    mine = make_building()
    as_building_admin(client, make_user, mine)
    assert client.delete(f"/buildings/{mine.id}").status_code == 403
