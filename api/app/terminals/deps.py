import uuid
from typing import Annotated

from fastapi import Depends, HTTPException

from app.auth.deps import CurrentAdmin
from app.buildings.deps import can_reach
from app.core.db import SessionDep
from app.terminals import db as terminals_db
from app.terminals.models import Terminal


def reachable_terminal(terminal_id: uuid.UUID, admin: CurrentAdmin, session: SessionDep) -> Terminal:
    """The `{terminal_id}` in the URL, if it's active and the admin can reach its building.

    404 for a terminal you can't reach, so the answer doesn't reveal that it exists.
    """
    terminal = terminals_db.get_active_terminal(session, terminal_id)
    if terminal is None or not terminal.building.is_active or not can_reach(admin, terminal.building_id):
        raise HTTPException(404, "Terminal not found.")
    return terminal


# Short form for admin routes with `{terminal_id}` in the path: `terminal: ReachableTerminal`.
ReachableTerminal = Annotated[Terminal, Depends(reachable_terminal)]


# GIL-79 (Identify + access log): the guard for terminal-only endpoints. Identify is the first to use it.
# To restore: uncomment this and add back the imports
#   import hmac
#   from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
#   from app.core.security import terminal_key

# # The `Authorization: Bearer <key>` header.
# # auto_error=False: a missing header gives None, so current_terminal answers its own 401.
# BearerCredentials = Annotated[HTTPAuthorizationCredentials | None, Depends(HTTPBearer(auto_error=False))]
#
#
# def current_terminal(terminal_id: uuid.UUID, credentials: BearerCredentials, session: SessionDep) -> Terminal:
#     """The `{terminal_id}` in the URL, if the request carries its key. Never reads the admin cookie.
#
#     Every failure is the same 401, so the answer doesn't reveal which check failed.
#     """
#     not_signed_in = HTTPException(401, "Terminal not signed in.", headers={"WWW-Authenticate": "Bearer"})
#     if credentials is None:
#         raise not_signed_in
#     if not hmac.compare_digest(credentials.credentials, terminal_key(terminal_id)):
#         raise not_signed_in
#     terminal = terminals_db.get_active_terminal(session, terminal_id)
#     if terminal is None or not terminal.building.is_active:
#         raise not_signed_in
#     return terminal
#
#
# # Short form for terminal-only routes: `terminal: CurrentTerminal`.
# CurrentTerminal = Annotated[Terminal, Depends(current_terminal)]
