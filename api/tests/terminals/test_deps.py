"""The `SignedTerminal` guard, called directly.

It takes no request or cookie, only the Bearer header. The HTTP test that an admin cookie
can't act as a terminal is with identify, in tests/access.
"""

import uuid

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.security import terminal_key
from app.terminals.deps import signed_terminal


def bearer(key: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=key)


def assert_refused(session: Session, terminal_id: uuid.UUID, credentials: HTTPAuthorizationCredentials | None) -> None:
    with pytest.raises(HTTPException) as error:
        signed_terminal(terminal_id, credentials, session)
    assert error.value.status_code == 401
    assert error.value.headers == {"WWW-Authenticate": "Bearer"}


def test_accepts_the_terminals_own_key(session: Session, make_building, make_terminal):
    terminal = make_terminal(make_building())
    assert signed_terminal(terminal.id, bearer(terminal_key(terminal.id)), session) == terminal


def test_refuses_missing_or_wrong_key(session: Session, make_building, make_terminal):
    building = make_building()
    terminal = make_terminal(building, "A")
    other = make_terminal(building, "B")
    assert_refused(session, terminal.id, None)
    assert_refused(session, terminal.id, bearer("wrong"))
    assert_refused(session, terminal.id, bearer(terminal_key(other.id)))


def test_refuses_removed_terminal_or_deactivated_building(session: Session, make_building, make_terminal):
    removed = make_terminal(make_building("North Tower"))
    removed.is_active = False
    closed = make_building("Cedar Court")
    in_closed = make_terminal(closed)
    closed.is_active = False
    session.flush()
    assert_refused(session, removed.id, bearer(terminal_key(removed.id)))
    assert_refused(session, in_closed.id, bearer(terminal_key(in_closed.id)))


def test_refuses_unknown_terminal_with_its_derived_key(session: Session):
    unknown = uuid.uuid4()
    assert_refused(session, unknown, bearer(terminal_key(unknown)))
