import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.access.models import AccessEvent, AccessResult
from app.people.models import Person
from app.terminals.models import Terminal


@dataclass
class FaceSearchResult:
    person: Person
    # Cosine similarity: 1 is the same face, around 0 is unrelated.
    similarity: float


def similarity_face_search(
    session: Session, building_id: uuid.UUID, embedding: list[float]
) -> FaceSearchResult | None:
    """The active person in the building whose face is most like `embedding`.

    None when the building has nobody enrolled.
    """
    distance = Person.embedding.cosine_distance(embedding)
    row = session.execute(
        select(Person, distance)
        .where(Person.building_id == building_id, Person.is_active)
        .order_by(distance)
        .limit(1)
    ).first()
    if row is None:
        return None
    person, distance_value = row
    return FaceSearchResult(person=person, similarity=1 - float(distance_value))


def add_event(session: Session, event: AccessEvent) -> AccessEvent:
    session.add(event)
    session.flush()
    return event


def list_events(
    session: Session,
    building_id: uuid.UUID,
    terminal_id: uuid.UUID | None,
    result: AccessResult | None,
    limit: int,
) -> list[tuple[AccessEvent, str, str | None]]:
    """Newest first, with the terminal's name and the person's name (removed ones too)."""
    query = (
        select(AccessEvent, Terminal.name, Person.name)
        .join(Terminal, Terminal.id == AccessEvent.terminal_id)
        .outerjoin(Person, Person.id == AccessEvent.person_id)
        .where(AccessEvent.building_id == building_id)
    )
    if terminal_id:
        query = query.where(AccessEvent.terminal_id == terminal_id)
    if result:
        query = query.where(AccessEvent.result == result)
    rows = session.execute(query.order_by(AccessEvent.created_at.desc()).limit(limit))
    return [(event, terminal_name, person_name) for event, terminal_name, person_name in rows]
