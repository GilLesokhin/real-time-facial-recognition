from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session

from app.core.config import settings


class Base(DeclarativeBase):
    """Every table class inherits from this. Alembic reads Base.metadata."""


engine = create_engine(settings.DATABASE_URL)


def get_session() -> Iterator[Session]:
    """One database session per request. Closing it rolls back anything a service didn't commit."""
    with Session(engine) as session:
        yield session


# Short form for routes: `session: SessionDep` instead of `session: Session = Depends(get_session)`.
SessionDep = Annotated[Session, Depends(get_session)]
