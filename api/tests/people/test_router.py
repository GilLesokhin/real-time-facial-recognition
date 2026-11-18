import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app.people.models import Person
from app.users.models import UserRole
from tests.conftest import face_vector


def add(client: TestClient, building_id, name="Dana Levi", apartment="4B", photo=b"face:dana"):
    return client.post(
        f"/buildings/{building_id}/people",
        data={"name": name, "apartment": apartment},
        files={"photo": ("dana.jpg", photo, "image/jpeg")},
    )


# --- POST /buildings/{id}/people ---


def test_add_person_stores_photo_and_embedding(client: TestClient, session: Session, sign_in, make_building):
    building = make_building()
    sign_in()
    r = add(client, building.id)
    assert r.status_code == 201
    body = r.json()
    assert set(body) == {"id", "building_id", "name", "apartment", "created_at"}
    person = session.get(Person, body["id"])
    assert list(person.embedding) == pytest.approx(face_vector("face:dana"), abs=1e-6)
    assert person.photo == b"jpeg:face:dana"


def test_photo_with_no_face_is_rejected(client: TestClient, sign_in, make_building):
    building = make_building()
    sign_in()
    r = add(client, building.id, photo=b"a wall")
    assert r.status_code == 422
    assert r.json()["detail"] == "No face found in the photo."


def test_another_buildings_admin_cant_add(client: TestClient, sign_in, make_building):
    mine = make_building("North Tower")
    other = make_building("South Tower")
    sign_in(UserRole.BUILDING_ADMIN, mine)
    assert add(client, other.id).status_code == 404


# --- GET /buildings/{id}/people ---


def test_list_and_search(client: TestClient, sign_in, make_building):
    building = make_building()
    sign_in()
    add(client, building.id, "Dana Levi", "4B")
    add(client, building.id, "Omer Cohen", "7A")
    r = client.get(f"/buildings/{building.id}/people")
    assert [p["name"] for p in r.json()] == ["Omer Cohen", "Dana Levi"]  # newest first
    assert [p["name"] for p in client.get(f"/buildings/{building.id}/people", params={"q": "7a"}).json()] == [
        "Omer Cohen"
    ]


def test_photo_is_never_loaded_unless_asked(session: Session, make_building, make_person):
    building = make_building()
    person = make_person(building)
    session.expire_all()
    loaded = session.get(Person, person.id)
    assert "photo" in inspect(loaded).unloaded
    listed = session.scalars(select(Person)).first()
    assert "photo" in inspect(listed).unloaded


# --- GET /people/{id}/photo ---


def test_get_photo(client: TestClient, sign_in, make_building):
    building = make_building()
    sign_in()
    person_id = add(client, building.id).json()["id"]
    r = client.get(f"/people/{person_id}/photo")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/jpeg"
    assert r.content == b"jpeg:face:dana"


def test_another_buildings_photo_is_not_found(client: TestClient, sign_in, make_building, make_person):
    mine = make_building("North Tower")
    person = make_person(make_building("South Tower"))
    sign_in(UserRole.BUILDING_ADMIN, mine)
    assert client.get(f"/people/{person.id}/photo").status_code == 404
    assert client.patch(f"/people/{person.id}", data={"name": "X"}).status_code == 404
    assert client.delete(f"/people/{person.id}").status_code == 404


# --- PATCH and DELETE /people/{id} ---


def test_edit_name_keeps_photo(client: TestClient, session: Session, sign_in, make_building):
    building = make_building()
    sign_in()
    person_id = add(client, building.id).json()["id"]
    r = client.patch(f"/people/{person_id}", data={"name": "Dana Cohen"})
    assert r.status_code == 200
    assert r.json()["name"] == "Dana Cohen"
    assert r.json()["apartment"] == "4B"
    assert session.get(Person, person_id).photo == b"jpeg:face:dana"


def test_new_photo_replaces_photo_and_embedding(client: TestClient, session: Session, sign_in, make_building):
    building = make_building()
    sign_in()
    person_id = add(client, building.id).json()["id"]
    r = client.patch(f"/people/{person_id}", files={"photo": ("new.jpg", b"face:new", "image/jpeg")})
    assert r.status_code == 200
    person = session.get(Person, person_id)
    assert person.photo == b"jpeg:face:new"
    assert list(person.embedding) == pytest.approx(face_vector("face:new"), abs=1e-6)


def test_delete_deactivates(client: TestClient, session: Session, sign_in, make_building):
    building = make_building()
    sign_in()
    person_id = add(client, building.id).json()["id"]
    assert client.delete(f"/people/{person_id}").status_code == 204
    assert not session.get(Person, person_id).is_active
    assert client.get(f"/buildings/{building.id}/people").json() == []
    assert client.get(f"/people/{person_id}/photo").status_code == 404
