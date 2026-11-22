from fastapi import APIRouter, status

from app.auth.deps import CurrentAdmin
from app.buildings.deps import ReachableBuilding
from app.core.db import SessionDep
from app.terminals import service
from app.terminals.deps import ReachableTerminal
from app.terminals.schemas import (
    TerminalCreateRequest,
    TerminalCreateResponse,
    TerminalKeyResponse,
    TerminalListItem,
    TerminalUpdateRequest,
    TerminalUpdateResponse,
)

router = APIRouter(tags=["terminals"])


@router.get("/buildings/{building_id}/terminals", response_model=list[TerminalListItem])
def list_terminals(admin: CurrentAdmin, building: ReachableBuilding, session: SessionDep):
    """The building's terminals by name."""
    return service.list_terminals(session, building)


@router.post(
    "/buildings/{building_id}/terminals", response_model=TerminalCreateResponse, status_code=status.HTTP_201_CREATED
)
def add_terminal(body: TerminalCreateRequest, admin: CurrentAdmin, building: ReachableBuilding, session: SessionDep):
    return service.add_terminal(session, building, body.name)


@router.patch("/terminals/{terminal_id}", response_model=TerminalUpdateResponse)
def rename_terminal(body: TerminalUpdateRequest, admin: CurrentAdmin, terminal: ReachableTerminal, session: SessionDep):
    return service.rename_terminal(session, terminal, body.name)


@router.delete("/terminals/{terminal_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_terminal(admin: CurrentAdmin, terminal: ReachableTerminal, session: SessionDep) -> None:
    """Soft delete. Its past checks stay in the access log."""
    service.remove_terminal(session, terminal)


@router.get("/terminals/{terminal_id}/key", response_model=TerminalKeyResponse)
def get_terminal_key(admin: CurrentAdmin, terminal: ReachableTerminal):
    """The terminal tab calls this once when it opens, with the names it shows.
    Then it sends the key as `Authorization: Bearer <key>`."""
    return service.get_key(terminal)
