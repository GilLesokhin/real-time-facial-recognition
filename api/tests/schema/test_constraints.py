"""The database itself refuses bad rows, whatever the code above it does."""

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.access.models import AccessEvent, AccessResult
from app.users.models import UserRole


def assert_refused(session: Session, row) -> None:
    session.add(row)
    with pytest.raises(IntegrityError):
        session.flush()


def event(building, terminal, result=AccessResult.DENIED, person=None) -> AccessEvent:
    return AccessEvent(
        building_id=building.id, terminal_id=terminal.id, person_id=person.id if person else None, result=result
    )


# --- users: CHECK a Building Admin has a building, nobody else has one ---


def test_building_admin_needs_a_building(make_user):
    with pytest.raises(IntegrityError):
        make_user("ana@example.com", UserRole.BUILDING_ADMIN)


@pytest.mark.parametrize("role", [UserRole.PLATFORM_ADMIN, UserRole.UNASSIGNED])
def test_only_a_building_admin_has_a_building(make_user, make_building, role):
    building = make_building()
    with pytest.raises(IntegrityError):
        make_user("ana@example.com", role, building)


def test_building_admin_with_a_building_is_fine(make_user, make_building):
    make_user("ana@example.com", UserRole.BUILDING_ADMIN, make_building())


# --- users: unique email, ignoring case ---


@pytest.mark.parametrize("second", ["ana@example.com", "ANA@EXAMPLE.COM", "Ana@Example.com"])
def test_user_emails_are_unique_ignoring_case(make_user, second):
    make_user("ana@example.com")
    with pytest.raises(IntegrityError, match="uq_users_email"):
        make_user(second)


# --- access_events: CHECK granted has a person, denied has none ---


def test_granted_needs_a_person(session, make_building, make_terminal):
    building = make_building()
    assert_refused(session, event(building, make_terminal(building), AccessResult.GRANTED))


def test_denied_has_no_person(session, make_building, make_terminal, make_person):
    building = make_building()
    row = event(building, make_terminal(building), AccessResult.DENIED, make_person(building))
    assert_refused(session, row)


def test_granted_and_denied_events_are_fine(session, make_building, make_terminal, make_person):
    building = make_building()
    terminal = make_terminal(building)
    session.add_all(
        [
            event(building, terminal, AccessResult.GRANTED, make_person(building)),
            event(building, terminal, AccessResult.DENIED),
        ]
    )
    session.flush()


# --- access_events: the terminal and person are in the event's building ---


def test_event_refuses_a_terminal_from_another_building(session, make_building, make_terminal):
    north, harbor = make_building("North Tower"), make_building("Harbor House")
    assert_refused(session, event(north, make_terminal(harbor)))


def test_event_refuses_a_person_from_another_building(session, make_building, make_terminal, make_person):
    north, harbor = make_building("North Tower"), make_building("Harbor House")
    row = event(north, make_terminal(north), AccessResult.GRANTED, make_person(harbor))
    assert_refused(session, row)


# --- unique names among active rows, ignoring case ---


def test_building_names_are_unique_ignoring_case(make_building):
    make_building("North Tower")
    with pytest.raises(IntegrityError):
        make_building("NORTH tower")


def test_a_deactivated_building_frees_its_name(session, make_building):
    old = make_building("North Tower")
    old.is_active = False
    session.flush()
    make_building("North Tower")


def test_terminal_names_are_unique_within_a_building(make_building, make_terminal):
    building = make_building()
    make_terminal(building, "Main lobby")
    with pytest.raises(IntegrityError):
        make_terminal(building, "main LOBBY")


def test_two_buildings_can_have_the_same_terminal_name(make_building, make_terminal):
    make_terminal(make_building("North Tower"), "Main lobby")
    make_terminal(make_building("Harbor House"), "Main lobby")


def test_a_deactivated_terminal_frees_its_name(session, make_building, make_terminal):
    building = make_building()
    old = make_terminal(building, "Main lobby")
    old.is_active = False
    session.flush()
    make_terminal(building, "Main lobby")


# --- foreign keys: ON DELETE RESTRICT ---


@pytest.mark.parametrize("child", ["terminal", "person", "admin"])
def test_a_building_in_use_cant_be_hard_deleted(session, make_building, make_terminal, make_person, make_user, child):
    building = make_building()
    if child == "terminal":
        make_terminal(building)
    if child == "person":
        make_person(building)
    if child == "admin":
        make_user("ana@example.com", UserRole.BUILDING_ADMIN, building)

    session.delete(building)
    with pytest.raises(IntegrityError):
        session.flush()


@pytest.mark.parametrize("parent", ["terminal", "person"])
def test_access_events_keep_their_terminal_and_person(session, make_building, make_terminal, make_person, parent):
    building = make_building()
    terminal = make_terminal(building)
    person = make_person(building)
    session.add(event(building, terminal, AccessResult.GRANTED, person))
    session.flush()

    if parent == "terminal":
        session.delete(terminal)
    if parent == "person":
        session.delete(person)
    with pytest.raises(IntegrityError):
        session.flush()
