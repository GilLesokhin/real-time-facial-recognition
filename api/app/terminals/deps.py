import hmac
import uuid
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.deps import SignedAdmin
from app.buildings.deps import can_manage
from app.core.db import SessionDep
from app.core.security import terminal_key
from app.terminals import db as terminals_db
from app.terminals.models import Terminal


def manageable_terminal(terminal_id: uuid.UUID, admin: SignedAdmin, session: SessionDep) -> Terminal:
    """The `{terminal_id}` in the URL, if it's active and the admin can manage its building.

    404 for a terminal you can't manage, so the answer doesn't reveal that it exists.
    """
    terminal = terminals_db.get_active_terminal(session, terminal_id)
    if terminal is None or not terminal.building.is_active or not can_manage(admin, terminal.building_id):
        raise HTTPException(404, "Terminal not found.")
    return terminal


# Short form for admin routes with `{terminal_id}` in the path: `terminal: ManageableTerminal`.
ManageableTerminal = Annotated[Terminal, Depends(manageable_terminal)]


# The `Authorization: Bearer <key>` header.
# auto_error=False: a missing header gives None, so signed_terminal answers its own 401.
BearerCredentials = Annotated[HTTPAuthorizationCredentials | None, Depends(HTTPBearer(auto_error=False))]


def signed_terminal(terminal_id: uuid.UUID, credentials: BearerCredentials, session: SessionDep) -> Terminal:
    """The `{terminal_id}` in the URL, if the request carries its key. Never reads the admin cookie.

    Every failure is the same 401, so the answer doesn't reveal which check failed.
    """
    not_signed_in = HTTPException(401, "Terminal not signed in.", headers={"WWW-Authenticate": "Bearer"})
    if credentials is None or not hmac.compare_digest(credentials.credentials, terminal_key(terminal_id)):
        raise not_signed_in
    terminal = terminals_db.get_active_terminal(session, terminal_id)
    if terminal is None or not terminal.building.is_active:
        raise not_signed_in
    return terminal


# Short form for terminal-only routes: `terminal: SignedTerminal`.
SignedTerminal = Annotated[Terminal, Depends(signed_terminal)]
