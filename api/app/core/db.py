from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import MetaData, create_engine
from sqlalchemy.orm import DeclarativeBase, Session

from app.core.config import settings


class Base(DeclarativeBase):
    # Fixed constraint names, so migrations can find and drop them.
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(column_0_label)s",
            "uq": "uq_%(table_name)s_%(column_0_N_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_N_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


engine = create_engine(settings.DATABASE_URL)


def get_session() -> Iterator[Session]:
    """One session per request. Closing it rolls back anything not committed."""
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]

# The 409 message for each unique index. See the handler in app/main.py.
CONFLICTS = {
    "uq_users_email": "An account with this email already exists.",
    "uq_buildings_active_name": "A building with this name already exists.",
    "uq_terminals_active_name": "This building already has a terminal with this name.",
}
