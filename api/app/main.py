from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from psycopg.errors import UniqueViolation
from sqlalchemy.exc import IntegrityError
from starlette.middleware.sessions import SessionMiddleware

from app.auth.router import router as auth_router
from app.buildings.router import router as buildings_router
from app.core.config import settings
from app.core.db import CONFLICTS
from app.people.router import router as people_router
from app.terminals.router import router as terminals_router
from app.users.router import router as users_router

app = FastAPI(title="Real Time Facial Recognition API")

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SECRET_KEY,
    session_cookie="session",
    max_age=60 * 60 * 24,  # 1 day
    same_site="lax",
    https_only=settings.COOKIE_SECURE,
)

app.include_router(auth_router)
app.include_router(buildings_router)
app.include_router(people_router)
app.include_router(terminals_router)
app.include_router(users_router)


@app.exception_handler(IntegrityError)
def integrity_error(request: Request, exc: IntegrityError):
    """A unique index caught a duplicate the service didn't, e.g. two requests at once.

    Other constraint errors (CHECK, foreign key, NOT NULL) mean a bug, so they stay a 500.
    The request's transaction is rolled back when its session closes.
    """
    if isinstance(exc.orig, UniqueViolation):
        detail = CONFLICTS.get(exc.orig.diag.constraint_name or "", "This already exists.")
        return JSONResponse(status_code=409, content={"detail": detail})
    raise exc
