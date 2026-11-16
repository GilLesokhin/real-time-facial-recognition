from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware

from app.auth.router import router as auth_router
from app.core.config import settings

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
