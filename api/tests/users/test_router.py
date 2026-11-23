from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.users.models import User, UserRole
from tests.conftest import login

PLATFORM = "platform@example.com"
NO_ID = "00000000-0000-0000-0000-000000000000"


def as_platform_admin(client: TestClient, make_user) -> User:
    admin = make_user(PLATFORM)
    login(client, PLATFORM)
    return admin


def emails(response) -> list[str]:
    return [user["email"] for user in response.json()]


# --- Who can call ---


def test_needs_sign_in(client: TestClient):
    assert client.get("/users").status_code == 401
    assert client.patch(f"/users/{NO_ID}", json={"role": "unassigned", "building_id": None}).status_code == 401
    assert client.delete(f"/users/{NO_ID}").status_code == 401


def test_building_admin_is_refused(client: TestClient, make_user, make_building):
    make_user("building@example.com", UserRole.BUILDING_ADMIN, make_building())
    other = make_user("other@example.com", UserRole.UNASSIGNED)
    login(client, "building@example.com")
    assert client.get("/users").status_code == 403
    assert client.patch(f"/users/{other.id}", json={"role": "unassigned", "building_id": None}).status_code == 403
    assert client.delete(f"/users/{other.id}").status_code == 403


# --- GET /users ---


def test_lists_unassigned_first_then_by_name(client: TestClient, make_user, make_building):
    make_user("zoe@example.com", UserRole.UNASSIGNED)
    make_user("bob@example.com", UserRole.BUILDING_ADMIN, make_building())
    make_user("amy@example.com", UserRole.UNASSIGNED)
    as_platform_admin(client, make_user)

    response = client.get("/users")
    assert response.status_code == 200
    assert emails(response) == ["amy@example.com", "zoe@example.com", "bob@example.com", PLATFORM]
    assert set(response.json()[0]) == {"id", "name", "email", "role", "building_id", "created_at"}


def test_filters_by_role(client: TestClient, make_user):
    make_user("amy@example.com", UserRole.UNASSIGNED)
    as_platform_admin(client, make_user)
    assert emails(client.get("/users?role=unassigned")) == ["amy@example.com"]
    assert emails(client.get("/users?role=platform_admin")) == [PLATFORM]


def test_rejects_unknown_role(client: TestClient, make_user):
    as_platform_admin(client, make_user)
    assert client.get("/users?role=owner").status_code == 422


def test_building_filter_keeps_its_admins_and_all_platform_admins(client: TestClient, make_user, make_building):
    north = make_building("North Tower")
    cedar = make_building("Cedar Court")
    make_user("north@example.com", UserRole.BUILDING_ADMIN, north)
    make_user("cedar@example.com", UserRole.BUILDING_ADMIN, cedar)
    make_user("amy@example.com", UserRole.UNASSIGNED)
    as_platform_admin(client, make_user)

    assert emails(client.get(f"/users?building={north.id}")) == ["north@example.com", PLATFORM]
    assert emails(client.get(f"/users?building={north.id}&role=building_admin")) == ["north@example.com"]


def test_search_matches_name_or_email_ignoring_case(client: TestClient, make_user):
    make_user("dana@example.com", UserRole.UNASSIGNED)
    make_user("ron@other.org", UserRole.UNASSIGNED)
    as_platform_admin(client, make_user)

    assert emails(client.get("/users?search=DAN")) == ["dana@example.com"]
    assert emails(client.get("/users?search=other.org")) == ["ron@other.org"]
    assert emails(client.get("/users?search=%25")) == []  # "%" is searched for, not used as a wildcard


# --- PATCH /users/{id} ---


def test_makes_building_admin(client: TestClient, make_user, make_building):
    building = make_building()
    user = make_user("amy@example.com", UserRole.UNASSIGNED)
    as_platform_admin(client, make_user)

    response = client.patch(f"/users/{user.id}", json={"role": "building_admin", "building_id": str(building.id)})
    assert response.status_code == 200
    assert response.json()["role"] == "building_admin"
    assert response.json()["building_id"] == str(building.id)


def test_makes_platform_admin_and_clears_building(client: TestClient, session: Session, make_user, make_building):
    user = make_user("amy@example.com", UserRole.BUILDING_ADMIN, make_building())
    as_platform_admin(client, make_user)

    assert client.patch(f"/users/{user.id}", json={"role": "platform_admin", "building_id": None}).status_code == 200
    session.refresh(user)
    assert user.role == UserRole.PLATFORM_ADMIN
    assert user.building_id is None


def test_building_admin_needs_a_building(client: TestClient, make_user):
    user = make_user("amy@example.com", UserRole.UNASSIGNED)
    as_platform_admin(client, make_user)

    response = client.patch(f"/users/{user.id}", json={"role": "building_admin", "building_id": None})
    assert response.status_code == 422
    assert response.json()["detail"] == "A Building Admin needs a building."


def test_building_admin_needs_an_active_building(client: TestClient, session: Session, make_user, make_building):
    closed = make_building()
    closed.is_active = False
    session.flush()
    user = make_user("amy@example.com", UserRole.UNASSIGNED)
    as_platform_admin(client, make_user)

    for building_id in [str(closed.id), NO_ID]:
        response = client.patch(f"/users/{user.id}", json={"role": "building_admin", "building_id": building_id})
        assert response.status_code == 422
        assert response.json()["detail"] == "Pick an active building."


def test_other_roles_cannot_have_a_building(client: TestClient, make_user, make_building):
    building = make_building()
    user = make_user("amy@example.com", UserRole.UNASSIGNED)
    as_platform_admin(client, make_user)

    response = client.patch(f"/users/{user.id}", json={"role": "platform_admin", "building_id": str(building.id)})
    assert response.status_code == 422
    assert response.json()["detail"] == "A Platform Admin manages every building. Set building_id to null."

    response = client.patch(f"/users/{user.id}", json={"role": "unassigned", "building_id": str(building.id)})
    assert response.status_code == 422
    assert response.json()["detail"] == "An Unassigned user has no building. Set building_id to null."


def test_cannot_change_own_role(client: TestClient, make_user):
    admin = as_platform_admin(client, make_user)

    response = client.patch(f"/users/{admin.id}", json={"role": "unassigned", "building_id": None})
    assert response.status_code == 403
    assert response.json()["detail"] == "You can't change your own role."


def test_change_unknown_user_is_404(client: TestClient, make_user):
    as_platform_admin(client, make_user)
    assert client.patch(f"/users/{NO_ID}", json={"role": "unassigned", "building_id": None}).status_code == 404


def test_demoted_admin_is_locked_out_at_once(client: TestClient, make_user):
    make_user("other@example.com")
    login(client, "other@example.com")
    other_cookies = dict(client.cookies)
    client.cookies.clear()
    as_platform_admin(client, make_user)
    other_id = next(user["id"] for user in client.get("/users").json() if user["email"] == "other@example.com")

    client.patch(f"/users/{other_id}", json={"role": "unassigned", "building_id": None})

    client.cookies.clear()
    client.cookies.update(other_cookies)
    assert client.get("/auth/me").status_code == 401


# --- DELETE /users/{id} ---


def test_deletes_user(client: TestClient, session: Session, make_user):
    user = make_user("amy@example.com", UserRole.UNASSIGNED)
    user_id = user.id
    as_platform_admin(client, make_user)

    assert client.delete(f"/users/{user_id}").status_code == 204
    assert session.get(User, user_id) is None
    assert client.delete(f"/users/{user_id}").status_code == 404


def test_cannot_delete_self(client: TestClient, make_user):
    admin = as_platform_admin(client, make_user)

    response = client.delete(f"/users/{admin.id}")
    assert response.status_code == 403
    assert response.json()["detail"] == "You can't delete your own account."
