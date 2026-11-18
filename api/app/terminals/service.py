import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.buildings import db as buildings_db
from app.buildings.service import reachable_building
from app.terminals import db
from app.terminals.keys import hash_key, new_key
from app.terminals.models import Terminal
from app.terminals.schemas import TerminalOut, TerminalScreenOut
from app.users.models import User

NOT_FOUND = "Terminal not found."
NAME_TAKEN = "This building already has a terminal with this name."


def reachable_terminal(session: Session, admin: User, terminal_id: uuid.UUID) -> Terminal:
    terminal = db.get_active_terminal(session, terminal_id)
    if terminal is None:
        raise HTTPException(404, NOT_FOUND)
    try:
        reachable_building(session, admin, terminal.building_id)
    except HTTPException:
        raise HTTPException(404, NOT_FOUND) from None
    return terminal


def list_terminals(session: Session, admin: User, building_id: uuid.UUID) -> list[TerminalOut]:
    reachable_building(session, admin, building_id)
    last = db.last_checks(session, building_id)
    return [
        TerminalOut(
            id=t.id,
            building_id=t.building_id,
            name=t.name,
            last_result=last[t.id].result if t.id in last else None,
            last_at=last[t.id].created_at if t.id in last else None,
        )
        for t in db.list_terminals(session, building_id)
    ]


def add_terminal(session: Session, admin: User, building_id: uuid.UUID, name: str) -> TerminalOut:
    reachable_building(session, admin, building_id)
    if db.name_taken(session, building_id, name):
        raise HTTPException(409, NAME_TAKEN)
    terminal = db.add_terminal(session, Terminal(building_id=building_id, name=name))
    session.commit()
    return TerminalOut(id=terminal.id, building_id=terminal.building_id, name=terminal.name)


def rename_terminal(session: Session, admin: User, terminal_id: uuid.UUID, name: str) -> TerminalOut:
    terminal = reachable_terminal(session, admin, terminal_id)
    if db.name_taken(session, terminal.building_id, name, except_id=terminal.id):
        raise HTTPException(409, NAME_TAKEN)
    terminal.name = name
    session.commit()
    return TerminalOut(id=terminal.id, building_id=terminal.building_id, name=terminal.name)


def remove_terminal(session: Session, admin: User, terminal_id: uuid.UUID) -> None:
    """Deactivates the terminal and signs it out. Its past checks stay in the log."""
    terminal = reachable_terminal(session, admin, terminal_id)
    terminal.is_active = False
    terminal.key_hash = None
    session.commit()


def make_key(session: Session, admin: User, terminal_id: uuid.UUID) -> str:
    """A new sign-in key. The old one stops working, so a terminal open elsewhere is signed out."""
    terminal = reachable_terminal(session, admin, terminal_id)
    key = new_key()
    terminal.key_hash = hash_key(key)
    session.commit()
    return key


def screen(session: Session, terminal: Terminal) -> TerminalScreenOut:
    building = buildings_db.get_active_building(session, terminal.building_id)
    assert building is not None  # the terminal guard checks it
    return TerminalScreenOut(
        id=terminal.id, name=terminal.name, building_id=building.id, building_name=building.name
    )
