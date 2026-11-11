from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Read from environment variables, then from api/.env."""

    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True, extra="ignore")

    DATABASE_URL: str
    TEST_DATABASE_URL: str | None = None

    # Signs the session cookie. Anyone who knows it can sign in as any user,
    # so it must be long and random: the app refuses to start with a short one.
    SECRET_KEY: str = Field(min_length=32)

    # True when served over HTTPS: the browser then only sends the cookie over HTTPS.
    COOKIE_SECURE: bool = False

    # The first Platform Admin, created by migration 0002 (`alembic upgrade head`).
    # Only read while migrating; changing them later does nothing.
    PLATFORM_ADMIN_EMAIL: str | None = None
    PLATFORM_ADMIN_PASSWORD: str | None = Field(default=None, min_length=8)
    PLATFORM_ADMIN_NAME: str = "Platform Admin"


settings = Settings()  # type: ignore[call-arg]  # values come from the environment
