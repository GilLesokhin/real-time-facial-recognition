import uuid

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.orm import Session

from app.access.models import AccessEvent
from app.terminals.models import Terminal


def list_active_terminals(session: Session, building_id: uuid.UUID) -> list[Terminal]:
    query = (
        select(Terminal)
        .where(Terminal.building_id == building_id, Terminal.is_active)
        .order_by(func.lower(Terminal.name))
    )
    return list(session.scalars(query))


def get_active_terminal(session: Session, terminal_id: uuid.UUID) -> Terminal | None:
    terminal = session.get(Terminal, terminal_id)
    if terminal is None or not terminal.is_active:
        return None
    return terminal


def get_active_terminal_by_name(session: Session, building_id: uuid.UUID, name: str) -> Terminal | None:
    query = select(Terminal).where(
        Terminal.building_id == building_id,
        Terminal.is_active,
        func.lower(Terminal.name) == name.lower(),
    )
    return session.scalars(query).first()


def add_terminal(session: Session, terminal: Terminal) -> Terminal:
    session.add(terminal)
    session.flush()
    return terminal


def latest_events(session: Session, building_id: uuid.UUID) -> dict[uuid.UUID, AccessEvent]:
    """The newest access event of each terminal in the building, by terminal id."""
    query = (
        select(AccessEvent)
        .where(AccessEvent.building_id == building_id)
        .ext(distinct_on(AccessEvent.terminal_id))
        .order_by(AccessEvent.terminal_id, AccessEvent.created_at.desc())
    )
    return {event.terminal_id: event for event in session.scalars(query)}
