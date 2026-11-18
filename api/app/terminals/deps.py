import uuid
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.buildings import db as buildings_db
from app.core.db import SessionDep
from app.terminals import db
from app.terminals.keys import key_matches
from app.terminals.models import Terminal

# auto_error=False: a missing header gets our own 401 message instead of FastAPI's 403.
bearer = HTTPBearer(auto_error=False)


def current_terminal(
    terminal_id: uuid.UUID,
    session: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> Terminal:
    """The terminal in the URL, if the request carries its key. An admin's cookie never counts."""
    terminal = db.get_active_terminal(session, terminal_id)
    if (
        terminal is None
        or credentials is None
        or not key_matches(credentials.credentials, terminal.key_hash)
        or buildings_db.get_active_building(session, terminal.building_id) is None
    ):
        raise HTTPException(401, "This terminal isn't signed in. Open it again from the Terminals page.")
    return terminal


# Short form for routes: `terminal: CurrentTerminal`.
CurrentTerminal = Annotated[Terminal, Depends(current_terminal)]
