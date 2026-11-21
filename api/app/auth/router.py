from fastapi import APIRouter, Request, status

from app.auth import service
from app.auth.deps import SESSION_USER_ID, CurrentAdmin
from app.auth.schemas import (
    LoginRequest,
    LoginResponse,
    MeResponse,
    SignupRequest,
    SignupResponse,
)
from app.core.db import SessionDep

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, session: SessionDep):
    """Create an Unassigned account. Doesn't sign you in."""
    return service.sign_up(session, body.name, body.email, body.password)


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, request: Request, session: SessionDep):
    user = service.log_in(session, body.email, body.password)
    request.session.clear()
    request.session[SESSION_USER_ID] = str(user.id)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request) -> None:
    request.session.clear()


@router.get("/me", response_model=MeResponse)
def me(admin: CurrentAdmin):
    return admin
