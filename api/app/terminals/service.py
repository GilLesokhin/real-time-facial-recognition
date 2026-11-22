from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.buildings.models import Building
from app.core.security import terminal_key
from app.terminals import db as terminals_db
from app.terminals.models import Terminal
from app.terminals.schemas import TerminalKeyResponse


def list_terminals(session: Session, building: Building) -> list[Terminal]:
    """The building's active terminals by name."""
    return terminals_db.list_active_terminals(session, building.id)


# GIL-79 (Identify + access log): the list with each terminal's newest event. To restore, uncomment
# and import `LatestEvent` and `TerminalListItem` from app.terminals.schemas.
# def list_terminals(session: Session, building: Building) -> list[TerminalListItem]:
#     """The building's active terminals by name, each with its newest event."""
#     terminals = terminals_db.list_active_terminals(session, building.id)
#     latest_events = terminals_db.latest_events(session, building.id)
#     items = []
#     for terminal in terminals:
#         event = latest_events.get(terminal.id)
#         latest_event = LatestEvent.model_validate(event) if event else None
#         items.append(
#             TerminalListItem(id=terminal.id, building_id=terminal.building_id, name=terminal.name, latest_event=latest_event)
#         )
#     return items


def add_terminal(session: Session, building: Building, name: str) -> Terminal:
    if terminals_db.get_active_terminal_by_name(session, building.id, name):
        raise HTTPException(409, "This building already has a terminal with this name.")
    terminal = terminals_db.add_terminal(session, Terminal(building_id=building.id, name=name))
    session.commit()
    return terminal


def rename_terminal(session: Session, terminal: Terminal, name: str) -> Terminal:
    same_name = terminals_db.get_active_terminal_by_name(session, terminal.building_id, name)
    if same_name and same_name.id != terminal.id:
        raise HTTPException(409, "This building already has a terminal with this name.")
    terminal.name = name
    session.commit()
    return terminal


def remove_terminal(session: Session, terminal: Terminal) -> None:
    """Soft delete: the terminal's key stops working. Its past checks stay in the access log."""
    terminal.is_active = False
    session.commit()


def get_key(terminal: Terminal) -> TerminalKeyResponse:
    return TerminalKeyResponse(
        id=terminal.id,
        building_id=terminal.building_id,
        name=terminal.name,
        building_name=terminal.building.name,
        key=terminal_key(terminal.id),
    )
