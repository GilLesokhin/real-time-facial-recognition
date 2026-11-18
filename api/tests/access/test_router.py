from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.access.models import AccessEvent
from app.users.models import UserRole


def identify(client: TestClient, terminal_id, headers, image: bytes = b"face:dana"):
    return client.post(
        f"/terminals/{terminal_id}/identify", files={"image": ("face.jpg", image, "image/jpeg")}, headers=headers
    )


def open_terminal(client: TestClient, terminal_id) -> dict[str, str]:
    key = client.post(f"/terminals/{terminal_id}/key").json()["key"]
    return {"Authorization": f"Bearer {key}"}


# --- POST /terminals/{id}/identify ---


def test_known_face_is_granted_and_logged(
    client: TestClient, session: Session, sign_in, make_building, make_terminal, make_person
):
    building = make_building()
    terminal = make_terminal(building)
    person = make_person(building, "Dana Levi", face="face:dana")
    sign_in()
    r = identify(client, terminal.id, open_terminal(client, terminal.id))
    assert r.status_code == 200
    assert r.json() == {"result": "granted", "person": {"id": str(person.id), "name": "Dana Levi"}, "score": 1.0}
    [event] = session.scalars(select(AccessEvent)).all()
    assert (event.result, event.person_id, event.score) == ("granted", person.id, 1.0)


def test_unknown_face_is_denied_and_logged_without_person(
    client: TestClient, session: Session, sign_in, make_building, make_terminal, make_person
):
    building = make_building()
    terminal = make_terminal(building)
    make_person(building, face="face:dana")
    sign_in()
    r = identify(client, terminal.id, open_terminal(client, terminal.id), b"face:stranger")
    assert r.json()["result"] == "denied"
    assert r.json()["person"] is None
    assert r.json()["score"] < 0.363
    [event] = session.scalars(select(AccessEvent)).all()
    assert event.person_id is None


def test_nobody_enrolled_is_denied_with_no_score(client: TestClient, sign_in, make_building, make_terminal):
    terminal = make_terminal(make_building())
    sign_in()
    r = identify(client, terminal.id, open_terminal(client, terminal.id))
    assert r.json() == {"result": "denied", "person": None, "score": None}


def test_removed_person_is_denied(client: TestClient, sign_in, make_building, make_terminal, make_person):
    building = make_building()
    terminal = make_terminal(building)
    person = make_person(building, face="face:dana")
    sign_in()
    headers = open_terminal(client, terminal.id)
    assert identify(client, terminal.id, headers).json()["result"] == "granted"
    client.delete(f"/people/{person.id}")
    assert identify(client, terminal.id, headers).json()["result"] == "denied"


def test_another_buildings_person_is_denied(client: TestClient, sign_in, make_building, make_terminal, make_person):
    terminal = make_terminal(make_building("North Tower"))
    make_person(make_building("South Tower"), face="face:dana")
    sign_in()
    assert identify(client, terminal.id, open_terminal(client, terminal.id)).json()["result"] == "denied"


def test_image_with_no_face_is_422_and_not_logged(
    client: TestClient, session: Session, sign_in, make_building, make_terminal
):
    terminal = make_terminal(make_building())
    sign_in()
    assert identify(client, terminal.id, open_terminal(client, terminal.id), b"a wall").status_code == 422
    assert session.scalars(select(AccessEvent)).all() == []


def test_identify_needs_terminal_key(client: TestClient, sign_in, make_building, make_terminal):
    terminal = make_terminal(make_building())
    sign_in()
    assert identify(client, terminal.id, {}).status_code == 401


# --- GET /buildings/{id}/access-log ---


def test_access_log_newest_first_with_filters(
    client: TestClient, sign_in, make_building, make_terminal, make_person
):
    building = make_building()
    lobby = make_terminal(building, "Main lobby")
    garage = make_terminal(building, "Garage")
    make_person(building, "Dana Levi", face="face:dana")
    sign_in()
    identify(client, lobby.id, open_terminal(client, lobby.id))
    identify(client, garage.id, open_terminal(client, garage.id), b"face:stranger")

    log = client.get(f"/buildings/{building.id}/access-log").json()
    assert [(e["terminal_name"], e["person_name"], e["result"]) for e in log] == [
        ("Garage", None, "denied"),
        ("Main lobby", "Dana Levi", "granted"),
    ]
    by_terminal = client.get(f"/buildings/{building.id}/access-log", params={"terminal": str(lobby.id)}).json()
    assert [e["terminal_name"] for e in by_terminal] == ["Main lobby"]
    by_result = client.get(f"/buildings/{building.id}/access-log", params={"result": "denied"}).json()
    assert [e["result"] for e in by_result] == ["denied"]


def test_access_log_keeps_removed_people(client: TestClient, sign_in, make_building, make_terminal, make_person):
    building = make_building()
    terminal = make_terminal(building)
    person = make_person(building, "Dana Levi", face="face:dana")
    sign_in()
    identify(client, terminal.id, open_terminal(client, terminal.id))
    client.delete(f"/people/{person.id}")
    [event] = client.get(f"/buildings/{building.id}/access-log").json()
    assert event["person_name"] == "Dana Levi"


def test_another_buildings_log_is_not_found(client: TestClient, sign_in, make_building):
    mine = make_building("North Tower")
    other = make_building("South Tower")
    sign_in(UserRole.BUILDING_ADMIN, mine)
    assert client.get(f"/buildings/{other.id}/access-log").status_code == 404
