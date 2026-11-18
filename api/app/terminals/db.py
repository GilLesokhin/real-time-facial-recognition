import uuid

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.orm import Session

from app.access.models import AccessEvent
from app.terminals.models import Terminal


def get_active_terminal(session: Session, terminal_id: uuid.UUID) -> Terminal | None:
    terminal = session.get(Terminal, terminal_id)
    return terminal if terminal and terminal.is_active else None


def list_terminals(session: Session, building_id: uuid.UUID) -> list[Terminal]:
    query = select(Terminal).where(Terminal.building_id == building_id, Terminal.is_active)
    return list(session.scalars(query.order_by(func.lower(Terminal.name))))


def last_checks(session: Session, building_id: uuid.UUID) -> dict[uuid.UUID, AccessEvent]:
    """Each terminal's newest access event, by terminal id."""
    query = (
        select(AccessEvent)
        .where(AccessEvent.building_id == building_id)
        .ext(distinct_on(AccessEvent.terminal_id))
        .order_by(AccessEvent.terminal_id, AccessEvent.created_at.desc())
    )
    return {event.terminal_id: event for event in session.scalars(query)}


def name_taken(session: Session, building_id: uuid.UUID, name: str, except_id: uuid.UUID | None = None) -> bool:
    query = select(Terminal.id).where(
        Terminal.building_id == building_id, Terminal.is_active, func.lower(Terminal.name) == name.lower()
    )
    if except_id:
        query = query.where(Terminal.id != except_id)
    return session.scalars(query).first() is not None


def add_terminal(session: Session, terminal: Terminal) -> Terminal:
    session.add(terminal)
    session.flush()
    return terminal
