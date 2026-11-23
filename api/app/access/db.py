import uuid

from sqlalchemy import Row, select
from sqlalchemy.orm import Session

from app.access.models import AccessEvent, AccessResult
from app.people.models import Person
from app.terminals.models import Terminal

# The access log shows only the newest events. There is no paging yet.
ACCESS_LOG_LIMIT = 100


def closest_match(session: Session, building_id: uuid.UUID, embedding: list[float]) -> Row[tuple[Person, float]] | None:
    """The active person in the building whose face is most like `embedding`, as `row.Person` and `row.score`.

    Only the search: the caller decides if the score is high enough.

    score is the cosine similarity (1 − cosine distance). None when no one is enrolled.
    """
    distance = Person.embedding.cosine_distance(embedding)
    query = (
        select(Person, (1 - distance).label("score"))
        .where(Person.building_id == building_id, Person.is_active)
        .order_by(distance)
        .limit(1)
    )
    return session.execute(query).first()


def add_event(session: Session, event: AccessEvent) -> AccessEvent:
    session.add(event)
    return event


def list_events(
    session: Session, building_id: uuid.UUID, terminal_id: uuid.UUID | None, result: AccessResult | None
) -> list[Row[tuple[AccessEvent, str | None, str]]]:
    """The building's newest events, newest first, as `row.AccessEvent`, `row.person_name` and `row.terminal_name`.

    Removed people and terminals keep their names here. person_name is None for a denied event.
    """
    query = (
        select(AccessEvent, Person.name.label("person_name"), Terminal.name.label("terminal_name"))
        .join(Terminal, AccessEvent.terminal_id == Terminal.id)
        .outerjoin(Person, AccessEvent.person_id == Person.id)
        .where(AccessEvent.building_id == building_id)
    )
    if terminal_id is not None:
        query = query.where(AccessEvent.terminal_id == terminal_id)
    if result is not None:
        query = query.where(AccessEvent.result == result)
    query = query.order_by(AccessEvent.created_at.desc()).limit(ACCESS_LOG_LIMIT)
    return list(session.execute(query))
