from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.users.models import UserRole

# --- GET /buildings ---


def test_platform_admin_sees_every_active_building(client: TestClient, sign_in, make_building):
    make_building("North Tower")
    make_building("Alpha House")
    sign_in()
    r = client.get("/buildings")
    assert r.status_code == 200
    assert [b["name"] for b in r.json()] == ["Alpha House", "North Tower"]


def test_building_admin_sees_only_their_building(client: TestClient, sign_in, make_building):
    mine = make_building("North Tower")
    make_building("South Tower")
    sign_in(UserRole.BUILDING_ADMIN, mine)
    assert [b["id"] for b in client.get("/buildings").json()] == [str(mine.id)]


def test_buildings_need_sign_in(client: TestClient):
    assert client.get("/buildings").status_code == 401


# --- POST, PATCH, DELETE ---


def test_platform_admin_adds_and_edits_a_building(client: TestClient, sign_in):
    sign_in()
    r = client.post("/buildings", json={"name": " North Tower ", "address": "12 Herzl St"})
    assert r.status_code == 201
    assert r.json()["name"] == "North Tower"
    building_id = r.json()["id"]

    r = client.patch(f"/buildings/{building_id}", json={"address": "14 Herzl St"})
    assert r.status_code == 200
    assert r.json() == {"id": building_id, "name": "North Tower", "address": "14 Herzl St"}


def test_building_names_are_unique_ignoring_case(client: TestClient, sign_in, make_building):
    make_building("North Tower")
    other = make_building("South Tower")
    sign_in()
    assert client.post("/buildings", json={"name": "north tower"}).status_code == 409
    assert client.patch(f"/buildings/{other.id}", json={"name": "NORTH TOWER"}).status_code == 409


def test_building_admin_cant_add_edit_or_delete(client: TestClient, sign_in, make_building):
    mine = make_building()
    sign_in(UserRole.BUILDING_ADMIN, mine)
    assert client.post("/buildings", json={"name": "New"}).status_code == 403
    assert client.patch(f"/buildings/{mine.id}", json={"name": "New"}).status_code == 403
    assert client.delete(f"/buildings/{mine.id}").status_code == 403


def test_delete_deactivates_building_people_and_terminals(
    client: TestClient, session: Session, sign_in, make_building, make_person, make_terminal
):
    building = make_building("North Tower")
    person = make_person(building)
    terminal = make_terminal(building)
    sign_in()
    assert client.delete(f"/buildings/{building.id}").status_code == 204
    session.refresh(building)
    session.refresh(person)
    session.refresh(terminal)
    assert not building.is_active and not person.is_active and not terminal.is_active
    assert client.get("/buildings").json() == []
    # The name is free again.
    assert client.post("/buildings", json={"name": "North Tower"}).status_code == 201


# --- The guard ---


def test_another_buildings_url_is_not_found(client: TestClient, sign_in, make_building):
    mine = make_building("North Tower")
    other = make_building("South Tower")
    sign_in(UserRole.BUILDING_ADMIN, mine)
    assert client.get(f"/buildings/{other.id}/people").status_code == 404
    assert client.get(f"/buildings/{other.id}/terminals").status_code == 404
    assert client.get(f"/buildings/{other.id}/access-log").status_code == 404
    assert client.get(f"/buildings/{mine.id}/people").status_code == 200


def test_deleted_building_is_not_found(client: TestClient, sign_in, make_building):
    building = make_building()
    sign_in()
    client.delete(f"/buildings/{building.id}")
    assert client.get(f"/buildings/{building.id}/people").status_code == 404
    assert client.patch(f"/buildings/{building.id}", json={"name": "X"}).status_code == 404


def test_me_returns_building_id(client: TestClient, sign_in, make_building):
    building = make_building()
    sign_in(UserRole.BUILDING_ADMIN, building)
    assert client.get("/auth/me").json()["building_id"] == str(building.id)
