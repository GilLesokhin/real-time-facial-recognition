"""Runs migrations. `uv run alembic upgrade head` uses DATABASE_URL; the tests pass their own URL."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

import app.users.models  # noqa: F401  registers the users table on Base.metadata
from app.core.config import settings
from app.core.db import Base

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

# Compared against the database by `alembic revision --autogenerate`.
# Import each new feature's models.py above so its tables are included.
target_metadata = Base.metadata

url = config.attributes.get("database_url", settings.DATABASE_URL)
engine = create_engine(url, poolclass=pool.NullPool)

with engine.connect() as connection:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()
