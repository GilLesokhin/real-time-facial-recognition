from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.users.models import UserRole
from tests.conftest import PASSWORD, login

COOKIE = "session"


def signup(client: TestClient, email: str = "ana@example.com", password: str = PASSWORD):
    return client.post("/auth/signup", json={"name": "Ana", "email": email, "password": password})


# --- POST /auth/signup ---


def test_signup_creates_unassigned_user_in_web_app_shape(client: TestClient):
    r = signup(client)
    assert r.status_code == 201
    body = r.json()
    assert set(body) == {"id", "name", "email", "role", "building_ids", "created_at"}
    assert body["role"] == "unassigned"
    assert body["building_ids"] == []
    assert COOKIE not in client.cookies  # signing up doesn't sign you in


def test_signup_rejects_taken_email_ignoring_case(client: TestClient):
    signup(client, "ana@example.com")
    assert signup(client, "ANA@Example.com").status_code == 409


def test_signup_rejects_short_password(client: TestClient):
    assert signup(client, password="short").status_code == 422


# --- POST /auth/login ---


def test_login_sets_session_cookie_and_me_returns_user(client: TestClient, make_user):
    make_user("admin@example.com")
    r = login(client, "admin@example.com")
    assert r.status_code == 200
    set_cookie = r.headers["set-cookie"].lower()
    assert set_cookie.startswith(f"{COOKIE}=")
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie

    me = client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "admin@example.com"


def test_login_ignores_email_case(client: TestClient, make_user):
    make_user("admin@example.com")
    assert login(client, "Admin@Example.com").status_code == 200


def test_wrong_password_and_unknown_email_get_the_same_answer(client: TestClient, make_user):
    make_user("admin@example.com")
    wrong_password = login(client, "admin@example.com", "wrong-password")
    unknown_email = login(client, "nobody@example.com")
    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()


def test_unassigned_user_is_refused_only_after_correct_password(client: TestClient, make_user):
    make_user("new@example.com", UserRole.UNASSIGNED)
    assert login(client, "new@example.com", "wrong-password").status_code == 401
    assert login(client, "new@example.com").status_code == 403
    assert COOKIE not in client.cookies


# --- GET /auth/me and POST /auth/logout ---


def test_me_without_cookie_is_401(client: TestClient):
    assert client.get("/auth/me").status_code == 401


def test_tampered_cookie_is_401(client: TestClient, make_user):
    make_user("admin@example.com")
    login(client, "admin@example.com")
    tampered = client.cookies[COOKIE][:-4] + "AAAA"  # breaks the signature
    client.cookies.clear()
    client.cookies.set(COOKIE, tampered)
    assert client.get("/auth/me").status_code == 401


def test_logout_signs_out(client: TestClient, make_user):
    make_user("admin@example.com")
    login(client, "admin@example.com")
    assert client.post("/auth/logout").status_code == 204
    assert client.get("/auth/me").status_code == 401


def test_demoted_user_is_signed_out_on_next_request(client: TestClient, session: Session, make_user):
    user = make_user("admin@example.com")
    login(client, "admin@example.com")
    user.role = UserRole.UNASSIGNED
    session.flush()
    assert client.get("/auth/me").status_code == 401
