import uuid

from fastapi import APIRouter, status

from app.auth.deps import CurrentAdmin
from app.core.db import SessionDep
from app.terminals import service
from app.terminals.deps import CurrentTerminal
from app.terminals.schemas import (
    TerminalIn,
    TerminalKeyOut,
    TerminalOut,
    TerminalScreenOut,
)

router = APIRouter(tags=["terminals"])


@router.get("/buildings/{building_id}/terminals", response_model=list[TerminalOut])
def list_terminals(building_id: uuid.UUID, admin: CurrentAdmin, session: SessionDep):
    """With each terminal's newest check."""
    return service.list_terminals(session, admin, building_id)


@router.post("/buildings/{building_id}/terminals", response_model=TerminalOut, status_code=status.HTTP_201_CREATED)
def add_terminal(building_id: uuid.UUID, body: TerminalIn, admin: CurrentAdmin, session: SessionDep):
    return service.add_terminal(session, admin, building_id, body.name.strip())


@router.patch("/terminals/{terminal_id}", response_model=TerminalOut)
def rename_terminal(terminal_id: uuid.UUID, body: TerminalIn, admin: CurrentAdmin, session: SessionDep):
    return service.rename_terminal(session, admin, terminal_id, body.name.strip())


@router.delete("/terminals/{terminal_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_terminal(terminal_id: uuid.UUID, admin: CurrentAdmin, session: SessionDep) -> None:
    service.remove_terminal(session, admin, terminal_id)


@router.post("/terminals/{terminal_id}/key", response_model=TerminalKeyOut)
def make_key(terminal_id: uuid.UUID, admin: CurrentAdmin, session: SessionDep):
    """For "Open terminal": a new sign-in key for the door screen. The old key stops working."""
    return TerminalKeyOut(key=service.make_key(session, admin, terminal_id))


@router.get("/terminals/{terminal_id}", response_model=TerminalScreenOut)
def screen(terminal: CurrentTerminal, session: SessionDep):
    """Terminal sign-in only: what the door screen shows."""
    return service.screen(session, terminal)
