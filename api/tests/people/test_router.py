from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.faces.embedding import embed_for_enrollment
from app.faces.upload import MAX_PHOTO_BYTES
from app.people.models import Person
from app.users.models import UserRole
from tests.conftest import login

PLATFORM = "platform@example.com"
BUILDING_ADMIN = "building@example.com"
NO_ID = "00000000-0000-0000-0000-000000000000"

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
FACE = (FIXTURES / "armstrong_1.jpg").read_bytes()
OTHER_FACE = (FIXTURES / "jemison.jpg").read_bytes()


def as_platform_admin(client: TestClient, make_user) -> None:
    make_user(PLATFORM)
    login(client, PLATFORM)


def as_building_admin(client: TestClient, make_user, building) -> None:
    make_user(BUILDING_ADMIN, UserRole.BUILDING_ADMIN, building)
    login(client, BUILDING_ADMIN)


def photo(data: bytes = FACE) -> dict:
    return {"photo": ("face.jpg", data, "image/jpeg")}


def as_png(image: np.ndarray) -> bytes:
    return cv2.imencode(".png", image)[1].tobytes()


def two_faces() -> bytes:
    face = cv2.imdecode(np.frombuffer(FACE, np.uint8), cv2.IMREAD_COLOR)
    return as_png(np.hstack([face, face]))


def names(response) -> list[str]:
    return [person["name"] for person in response.json()]


def saved_embedding(session: Session, person_id) -> list[float]:
    session.expire_all()  # read the row again from the database
    return list(session.get(Person, person_id).embedding)


def add(client: TestClient, building, name: str = "Dana Levi", apartment: str = "4B", data: bytes = FACE):
    return client.post(
        f"/buildings/{building.id}/people", data={"name": name, "apartment": apartment}, files=photo(data)
    )


# --- Who can call the endpoints ---


def test_endpoints_need_sign_in(client: TestClient, make_building, make_person):
    building = make_building()
    person = make_person(building)
    assert client.get(f"/buildings/{building.id}/people").status_code == 401
    assert add(client, building).status_code == 401
    assert client.patch(f"/people/{person.id}", data={"name": "Noa"}).status_code == 401
    assert client.delete(f"/people/{person.id}").status_code == 401


def test_building_admin_cant_manage_another_buildings_people(client: TestClient, make_user, make_building, make_person):
    mine = make_building("North Tower")
    other = make_building("Cedar Court")
    person = make_person(other)
    as_building_admin(client, make_user, mine)
    assert client.get(f"/buildings/{other.id}/people").status_code == 404
    assert add(client, other).status_code == 404
    assert client.patch(f"/people/{person.id}", data={"name": "Noa"}).status_code == 404
    assert client.delete(f"/people/{person.id}").status_code == 404


def test_building_admin_manages_own_buildings_people(client: TestClient, make_user, make_building, make_person):
    mine = make_building()
    person = make_person(mine)
    as_building_admin(client, make_user, mine)
    assert names(client.get(f"/buildings/{mine.id}/people")) == ["Dana Levi"]
    assert add(client, mine, "Noa Cohen").status_code == 201
    assert client.patch(f"/people/{person.id}", data={"name": "Dana Katz"}).status_code == 200
    assert client.delete(f"/people/{person.id}").status_code == 204


def test_person_in_a_deactivated_building_is_404(client: TestClient, session: Session, make_user, make_building, make_person):
    closed = make_building()
    person = make_person(closed)
    closed.is_active = False
    session.flush()
    as_platform_admin(client, make_user)
    assert client.get(f"/buildings/{closed.id}/people").status_code == 404
    assert client.patch(f"/people/{person.id}", data={"name": "Noa"}).status_code == 404
    assert client.delete(f"/people/{person.id}").status_code == 404


# --- GET /buildings/{id}/people ---


def test_lists_active_people_by_name(client: TestClient, session: Session, make_user, make_building, make_person):
    building = make_building()
    other = make_building("Cedar Court")
    make_person(building, "Dana Levi")
    make_person(building, "avi Mizrahi")
    removed = make_person(building, "Ben Shalev")
    removed.is_active = False
    make_person(other, "Other Person")
    session.flush()
    as_platform_admin(client, make_user)

    response = client.get(f"/buildings/{building.id}/people")
    assert response.status_code == 200
    assert names(response) == ["avi Mizrahi", "Dana Levi"]
    # Never the embedding.
    assert set(response.json()[0]) == {"id", "building_id", "name", "apartment", "created_at"}


def test_search_looks_in_name_and_apartment(client: TestClient, session: Session, make_user, make_building, make_person):
    building = make_building()
    make_person(building, "Dana Levi")
    noa = make_person(building, "Noa Cohen")
    noa.apartment = "12C"
    session.flush()
    as_platform_admin(client, make_user)

    assert names(client.get(f"/buildings/{building.id}/people", params={"search": "LEVI"})) == ["Dana Levi"]
    assert names(client.get(f"/buildings/{building.id}/people", params={"search": " 12c "})) == ["Noa Cohen"]
    assert names(client.get(f"/buildings/{building.id}/people", params={"search": "nobody"})) == []


def test_list_of_unknown_building_is_404(client: TestClient, make_user):
    as_platform_admin(client, make_user)
    assert client.get(f"/buildings/{NO_ID}/people").status_code == 404


# --- POST /buildings/{id}/people ---


def test_adds_person_with_the_photos_embedding(client: TestClient, session: Session, make_user, make_building):
    building = make_building()
    as_platform_admin(client, make_user)

    response = add(client, building, "  Dana Levi ", " 4B ")
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Dana Levi"  # trimmed
    assert body["apartment"] == "4B"
    assert body["building_id"] == str(building.id)
    assert "embedding" not in body
    assert saved_embedding(session, body["id"]) == pytest.approx(embed_for_enrollment(FACE), abs=1e-6)


@pytest.mark.parametrize("form", [{"name": " ", "apartment": "4B"}, {"name": "Dana", "apartment": ""}, {"name": "Dana"}])
def test_add_needs_name_and_apartment(client: TestClient, make_user, make_building, form):
    building = make_building()
    as_platform_admin(client, make_user)
    assert client.post(f"/buildings/{building.id}/people", data=form, files=photo()).status_code == 422


def test_add_needs_a_photo(client: TestClient, make_user, make_building):
    building = make_building()
    as_platform_admin(client, make_user)
    response = client.post(f"/buildings/{building.id}/people", data={"name": "Dana", "apartment": "4B"})
    assert response.status_code == 422


@pytest.mark.parametrize(
    ("data", "message"),
    [
        (as_png(np.full((320, 320, 3), 128, np.uint8)), "No face found in the photo."),
        (two_faces(), "This photo shows more than one face. Retake it with only one person in view."),
        (b"not an image", "The file is not an image."),
    ],
)
def test_add_refuses_a_photo_without_exactly_one_face(client: TestClient, make_user, make_building, data, message):
    building = make_building()
    as_platform_admin(client, make_user)

    response = add(client, building, data=data)
    assert response.status_code == 422
    assert response.json()["detail"] == message
    assert names(client.get(f"/buildings/{building.id}/people")) == []


def test_add_refuses_a_photo_over_1_mb(client: TestClient, make_user, make_building):
    building = make_building()
    as_platform_admin(client, make_user)

    response = add(client, building, data=FACE + b"\0" * MAX_PHOTO_BYTES)
    assert response.status_code == 413
    assert names(client.get(f"/buildings/{building.id}/people")) == []


# --- PATCH /people/{id} ---


def test_edit_changes_only_what_was_sent(client: TestClient, session: Session, make_user, make_building, make_person):
    person = make_person(make_building())
    embedding = saved_embedding(session, person.id)
    as_platform_admin(client, make_user)

    response = client.patch(f"/people/{person.id}", data={"name": " Dana Katz "})
    assert response.status_code == 200
    assert response.json()["name"] == "Dana Katz"
    assert response.json()["apartment"] == "4B"
    assert saved_embedding(session, person.id) == embedding


def test_edit_with_a_new_photo_replaces_the_embedding(
    client: TestClient, session: Session, make_user, make_building, make_person
):
    person = make_person(make_building())
    as_platform_admin(client, make_user)

    response = client.patch(f"/people/{person.id}", data={"apartment": "7A"}, files=photo(OTHER_FACE))
    assert response.status_code == 200
    assert response.json()["apartment"] == "7A"
    assert saved_embedding(session, person.id) == pytest.approx(embed_for_enrollment(OTHER_FACE), abs=1e-6)


def test_edit_with_a_bad_photo_changes_nothing(client: TestClient, session: Session, make_user, make_building, make_person):
    person = make_person(make_building())
    embedding = saved_embedding(session, person.id)
    as_platform_admin(client, make_user)

    response = client.patch(f"/people/{person.id}", data={"name": "Dana Katz"}, files=photo(two_faces()))
    assert response.status_code == 422
    session.expire_all()
    assert session.get(Person, person.id).name == "Dana Levi"
    assert saved_embedding(session, person.id) == embedding


def test_edit_refuses_an_empty_name(client: TestClient, make_user, make_building, make_person):
    person = make_person(make_building())
    as_platform_admin(client, make_user)
    assert client.patch(f"/people/{person.id}", data={"name": "  "}).status_code == 422


def test_edit_of_unknown_or_removed_person_is_404(
    client: TestClient, session: Session, make_user, make_building, make_person
):
    removed = make_person(make_building())
    removed.is_active = False
    session.flush()
    as_platform_admin(client, make_user)
    assert client.patch(f"/people/{removed.id}", data={"name": "Noa"}).status_code == 404
    assert client.patch(f"/people/{NO_ID}", data={"name": "Noa"}).status_code == 404


# --- DELETE /people/{id} ---


def test_remove_deactivates_the_person(client: TestClient, session: Session, make_user, make_building, make_person):
    building = make_building()
    person = make_person(building)
    as_platform_admin(client, make_user)

    assert client.delete(f"/people/{person.id}").status_code == 204
    assert names(client.get(f"/buildings/{building.id}/people")) == []
    session.expire_all()
    assert session.get(Person, person.id).is_active is False  # the row stays for the access log
    assert client.delete(f"/people/{person.id}").status_code == 404
