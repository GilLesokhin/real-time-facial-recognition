from fastapi.testclient import TestClient

from app.users.models import UserRole

# --- GET /users ---


def test_lists_unassigned_first_then_by_name(client: TestClient, sign_in, make_user):
    sign_in(email="zed@example.com")
    make_user("bob@example.com", UserRole.UNASSIGNED)
    make_user("amy@example.com", UserRole.PLATFORM_ADMIN)
    r = client.get("/users")
    assert r.status_code == 200
    assert [u["email"] for u in r.json()] == ["bob@example.com", "amy@example.com", "zed@example.com"]


def test_filters_by_role_building_and_text(client: TestClient, sign_in, make_user, make_building):
    north = make_building("North Tower")
    south = make_building("South Tower")
    sign_in(email="root@example.com")
    make_user("north@example.com", UserRole.BUILDING_ADMIN, north)
    make_user("south@example.com", UserRole.BUILDING_ADMIN, south)

    def emails(**params) -> set[str]:
        return {u["email"] for u in client.get("/users", params=params).json()}

    assert emails(role="building_admin") == {"north@example.com", "south@example.com"}
    # A building's Building Admins plus every Platform Admin.
    assert emails(building=str(north.id)) == {"north@example.com", "root@example.com"}
    assert emails(q="SOUTH") == {"south@example.com"}


def test_only_platform_admins_list_users(client: TestClient, sign_in, make_building):
    sign_in(UserRole.BUILDING_ADMIN, make_building())
    assert client.get("/users").status_code == 403


# --- PATCH /users/{id} ---


def test_make_a_building_admin(client: TestClient, sign_in, make_user, make_building):
    building = make_building()
    sign_in()
    user = make_user("new@example.com", UserRole.UNASSIGNED)
    r = client.patch(f"/users/{user.id}", json={"role": "building_admin", "building_id": str(building.id)})
    assert r.status_code == 200
    assert r.json()["role"] == "building_admin"
    assert r.json()["building_id"] == str(building.id)


def test_building_admin_needs_exactly_one_building(client: TestClient, sign_in, make_user, make_building):
    building = make_building()
    sign_in()
    user = make_user("new@example.com", UserRole.UNASSIGNED)
    assert client.patch(f"/users/{user.id}", json={"role": "building_admin"}).status_code == 422
    r = client.patch(f"/users/{user.id}", json={"role": "platform_admin", "building_id": str(building.id)})
    assert r.status_code == 422


def test_building_must_exist(client: TestClient, sign_in, make_user, make_building):
    building = make_building()
    sign_in()
    client.delete(f"/buildings/{building.id}")
    user = make_user("new@example.com", UserRole.UNASSIGNED)
    r = client.patch(f"/users/{user.id}", json={"role": "building_admin", "building_id": str(building.id)})
    assert r.status_code == 422


def test_cant_change_own_role(client: TestClient, sign_in):
    me = sign_in()
    assert client.patch(f"/users/{me.id}", json={"role": "unassigned"}).status_code == 400


# --- DELETE /users/{id} ---


def test_delete_a_user(client: TestClient, sign_in, make_user):
    sign_in()
    user = make_user("old@example.com", UserRole.UNASSIGNED)
    assert client.delete(f"/users/{user.id}").status_code == 204
    assert client.delete(f"/users/{user.id}").status_code == 404


def test_cant_delete_yourself(client: TestClient, sign_in):
    me = sign_in()
    assert client.delete(f"/users/{me.id}").status_code == 400
