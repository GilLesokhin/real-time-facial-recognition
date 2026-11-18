"""The database itself refuses bad rows, whatever the code above it does."""

import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.access.models import AccessEvent, AccessResult
from app.people.models import Person
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


def test_a_building_with_terminals_cant_be_hard_deleted(session, make_building, make_terminal):
    building = make_building()
    make_terminal(building)
    session.delete(building)
    with pytest.raises(IntegrityError):
        session.flush()


# --- people.photo is deferred ---


def test_loading_a_person_doesnt_load_the_photo(session, make_building, make_person):
    person_id = make_person(make_building()).id
    session.expunge_all()  # forget the person, so the next get reads the database

    person = session.get(Person, person_id)

    assert "photo" in inspect(person).unloaded
    assert person.photo == b"jpeg"  # still there when asked for
