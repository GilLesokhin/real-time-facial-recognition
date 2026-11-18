from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.access.models import AccessEvent, AccessResult
from app.terminals.models import Terminal
from app.users.models import UserRole


def open_terminal(client: TestClient, terminal_id) -> dict[str, str]:
    key = client.post(f"/terminals/{terminal_id}/key").json()["key"]
    return {"Authorization": f"Bearer {key}"}


# --- Admin endpoints ---


def test_add_rename_and_list(client: TestClient, sign_in, make_building):
    building = make_building()
    sign_in()
    r = client.post(f"/buildings/{building.id}/terminals", json={"name": "Main lobby"})
    assert r.status_code == 201
    terminal_id = r.json()["id"]
    assert client.patch(f"/terminals/{terminal_id}", json={"name": "Garage"}).json()["name"] == "Garage"
    terminals = client.get(f"/buildings/{building.id}/terminals").json()
    assert terminals == [
        {"id": terminal_id, "building_id": str(building.id), "name": "Garage", "last_result": None, "last_at": None}
    ]


def test_list_shows_last_check(
    client: TestClient, session: Session, sign_in, make_building, make_terminal
):
    building = make_building()
    terminal = make_terminal(building)
    session.add(AccessEvent(building_id=building.id, terminal_id=terminal.id, result=AccessResult.DENIED))
    session.flush()
    sign_in()
    [row] = client.get(f"/buildings/{building.id}/terminals").json()
    assert row["last_result"] == "denied"
    assert row["last_at"] is not None


def test_names_are_unique_in_a_building(client: TestClient, sign_in, make_building, make_terminal):
    building = make_building()
    make_terminal(building, "Main lobby")
    sign_in()
    r = client.post(f"/buildings/{building.id}/terminals", json={"name": "main LOBBY"})
    assert r.status_code == 409


def test_building_admin_manages_only_their_terminals(client: TestClient, sign_in, make_building, make_terminal):
    mine = make_building("North Tower")
    other = make_terminal(make_building("South Tower"))
    sign_in(UserRole.BUILDING_ADMIN, mine)
    assert client.post(f"/buildings/{mine.id}/terminals", json={"name": "Lobby"}).status_code == 201
    assert client.patch(f"/terminals/{other.id}", json={"name": "X"}).status_code == 404
    assert client.delete(f"/terminals/{other.id}").status_code == 404
    assert client.post(f"/terminals/{other.id}/key").status_code == 404


def test_remove_deactivates_and_signs_out(
    client: TestClient, session: Session, sign_in, make_building, make_terminal
):
    terminal = make_terminal(make_building())
    sign_in()
    headers = open_terminal(client, terminal.id)
    assert client.delete(f"/terminals/{terminal.id}").status_code == 204
    assert not session.get(Terminal, terminal.id).is_active
    assert client.get(f"/terminals/{terminal.id}", headers=headers).status_code == 401


# --- Terminal sign-in ---


def test_terminal_with_key_gets_its_screen(client: TestClient, sign_in, make_building, make_terminal):
    building = make_building("North Tower")
    terminal = make_terminal(building, "Main lobby")
    sign_in()
    headers = open_terminal(client, terminal.id)
    client.cookies.clear()  # the door screen has no admin cookie
    r = client.get(f"/terminals/{terminal.id}", headers=headers)
    assert r.status_code == 200
    assert r.json() == {
        "id": str(terminal.id),
        "name": "Main lobby",
        "building_id": str(building.id),
        "building_name": "North Tower",
    }


def test_admin_cookie_cant_act_as_terminal(client: TestClient, sign_in, make_building, make_terminal):
    terminal = make_terminal(make_building())
    sign_in()
    open_terminal(client, terminal.id)
    assert client.get(f"/terminals/{terminal.id}").status_code == 401


def test_wrong_or_old_key_is_refused(client: TestClient, sign_in, make_building, make_terminal):
    building = make_building()
    terminal = make_terminal(building)
    other = make_terminal(building, "Garage")
    sign_in()
    old = open_terminal(client, terminal.id)
    new = open_terminal(client, terminal.id)
    other_key = open_terminal(client, other.id)
    assert client.get(f"/terminals/{terminal.id}", headers=old).status_code == 401
    assert client.get(f"/terminals/{terminal.id}", headers=other_key).status_code == 401
    assert client.get(f"/terminals/{terminal.id}", headers=new).status_code == 200


def test_terminal_of_deleted_building_is_signed_out(client: TestClient, sign_in, make_building, make_terminal):
    building = make_building()
    terminal = make_terminal(building)
    sign_in()
    headers = open_terminal(client, terminal.id)
    client.delete(f"/buildings/{building.id}")
    assert client.get(f"/terminals/{terminal.id}", headers=headers).status_code == 401
